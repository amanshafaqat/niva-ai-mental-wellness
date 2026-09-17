import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIProviderFactory } from '../ai/ai-provider.factory';
import { AIMessage, AIConversationContext } from '../ai/interfaces/ai-provider.interface';
import {
  ConversationSummaryDto,
  ConversationDetailDto,
  UserPreferencesDto,
  UsageMetricsDto,
} from '@shared/types/conversation';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  // In-memory rate limiting tracking: userId -> timestamps
  private readonly rateLimits = new Map<string, number[]>();
  private readonly RATE_WINDOW_MS = 60 * 1000; // 1 minute
  private readonly MAX_MESSAGES_PER_MINUTE = 20;

  // In-memory usage metrics counters
  private metrics = {
    totalConversations: 0,
    activeConversations: 0,
    totalMessages: 0,
    totalAiRequests: 0,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiFactory: AIProviderFactory,
  ) {}

  /**
   * Rate limiting check per user
   */
  checkRateLimit(userId: string): void {
    const now = Date.now();
    const timestamps = this.rateLimits.get(userId) || [];
    const recent = timestamps.filter((ts) => now - ts < this.RATE_WINDOW_MS);

    if (recent.length >= this.MAX_MESSAGES_PER_MINUTE) {
      this.rateLimits.set(userId, recent);
      throw new HttpException(
        'Too many messages. Please slow down and take a gentle pause for a moment.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.rateLimits.set(userId, recent);
  }

  /**
   * Retrieve or initialize user preferences
   */
  async getPreferences(userId: string): Promise<UserPreferencesDto> {
    const prefs = await (this.prisma as any).userPreferences?.findUnique({
      where: { userId },
    });

    if (!prefs) {
      return {
        responseStyle: 'SHORT',
        conversationPreference: 'LISTEN_AND_RESPOND',
      };
    }

    return {
      responseStyle: prefs.responseStyle as any,
      conversationPreference: prefs.conversationPreference as any,
    };
  }

  /**
   * Upsert user preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<UserPreferencesDto>,
  ): Promise<UserPreferencesDto> {
    const current = await this.getPreferences(userId);
    const updated = {
      responseStyle: updates.responseStyle || current.responseStyle,
      conversationPreference: updates.conversationPreference || current.conversationPreference,
    };

    if ((this.prisma as any).userPreferences?.upsert) {
      await (this.prisma as any).userPreferences.upsert({
        where: { userId },
        create: {
          userId,
          responseStyle: updated.responseStyle,
          conversationPreference: updated.conversationPreference,
        },
        update: {
          responseStyle: updated.responseStyle,
          conversationPreference: updated.conversationPreference,
        },
      });
    }

    return updated;
  }

  /**
   * Start a new wellness conversation session
   */
  async startConversation(userId: string, title?: string): Promise<ConversationSummaryDto> {
    const defaultTitle = title?.trim() || `Session ${new Date().toLocaleDateString()}`;

    const conversation = await (this.prisma as any).conversation.create({
      data: {
        userId,
        title: defaultTitle,
        status: 'ACTIVE',
      },
    });

    this.metrics.totalConversations++;
    this.metrics.activeConversations++;

    return {
      id: conversation.id,
      userId: conversation.userId,
      title: conversation.title,
      status: conversation.status,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      endedAt: conversation.endedAt ? conversation.endedAt.toISOString() : null,
      messageCount: 0,
    };
  }

  /**
   * Get all conversations strictly owned by the authenticated user
   */
  async getUserConversations(userId: string): Promise<ConversationSummaryDto[]> {
    const list = await (this.prisma as any).conversation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return list.map((c: any) => ({
      id: c.id,
      userId: c.userId,
      title: c.title,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      endedAt: c.endedAt ? c.endedAt.toISOString() : null,
      messageCount: c._count?.messages ?? 0,
      lastMessageSnippet: c.messages?.[0]?.content?.slice(0, 80) ?? null,
    }));
  }

  /**
   * Get single conversation strictly verifying ownership
   */
  async getConversation(userId: string, conversationId: string): Promise<ConversationDetailDto> {
    const conversation = await (this.prisma as any).conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Session not found');
    }

    // Strict ownership verification: cannot access another user's session
    if (conversation.userId !== userId) {
      throw new ForbiddenException('Access denied. You do not own this wellness session.');
    }

    return {
      id: conversation.id,
      userId: conversation.userId,
      title: conversation.title,
      status: conversation.status,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      endedAt: conversation.endedAt ? conversation.endedAt.toISOString() : null,
      messages: conversation.messages.map((m: any) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Post message and receive NIVA AI reply
   */
  async postMessage(
    userId: string,
    conversationId: string,
    content: string,
  ): Promise<{ userMessage: any; assistantMessage: any }> {
    this.checkRateLimit(userId);

    const conversation = await (this.prisma as any).conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Session not found');
    }

    // Strict ownership validation
    if (conversation.userId !== userId) {
      throw new ForbiddenException('Access denied. You do not own this wellness session.');
    }

    if (conversation.status === 'ENDED') {
      throw new ForbiddenException('This wellness session has already ended. Please start a new session.');
    }

    const provider = this.aiFactory.getProvider();

    // 1. Evaluate safety triggers on user input
    const safetyEval = await provider.evaluateSafety(content);
    if (!safetyEval.isSafe) {
      const emergencyResponse =
        "I hear how much pain you are in right now, but I cannot provide guidance around self-harm. Please reach out to someone who can help keep you safe. You can call or text the Suicide & Crisis Lifeline at 988 (free and confidential), or reach your local emergency services right away. You do not have to carry this alone.";

      // Record messages
      const userMsg = await (this.prisma as any).conversationMessage.create({
        data: {
          conversationId,
          role: 'user',
          content: content.trim(),
        },
      });

      const assistantMsg = await (this.prisma as any).conversationMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: emergencyResponse,
        },
      });

      this.metrics.totalMessages += 2;

      return {
        userMessage: {
          id: userMsg.id,
          conversationId,
          role: 'user',
          content: userMsg.content,
          createdAt: userMsg.createdAt.toISOString(),
        },
        assistantMessage: {
          id: assistantMsg.id,
          conversationId,
          role: 'assistant',
          content: assistantMsg.content,
          createdAt: assistantMsg.createdAt.toISOString(),
        },
      };
    }

    // Save user message first
    const userMsg = await (this.prisma as any).conversationMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: content.trim(),
      },
    });

    this.metrics.totalMessages++;
    this.metrics.totalAiRequests++;

    // Fetch user preferences
    const prefs = await this.getPreferences(userId);

    // Build context window (recent messages)
    const history: AIMessage[] = [
      ...conversation.messages.map((m: any) => ({
        role: m.role as any,
        content: m.content,
      })),
      { role: 'user', content: content.trim() },
    ];

    const aiContext: AIConversationContext = {
      userId,
      conversationId,
      conversationStyle: prefs.responseStyle === 'SHORT' ? 'concise' : 'thoughtful',
      safetyDirectives: [
        'LISTEN MORE THAN TALK',
        'SHORT RESPONSES (1-3 sentences)',
        `PREFERENCE: ${prefs.conversationPreference}`,
      ],
    };

    let replyText = '';
    try {
      const aiReply = await provider.generateResponse(history, aiContext);
      replyText = aiReply.content;
    } catch (err: any) {
      this.logger.error(`AI reply generation error: ${err?.message || err}`);
      replyText = "I'm having trouble responding right now. Please try again in a moment.";
    }

    const assistantMsg = await (this.prisma as any).conversationMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: replyText,
      },
    });

    this.metrics.totalMessages++;

    // Update conversation updatedAt
    await (this.prisma as any).conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      userMessage: {
        id: userMsg.id,
        conversationId,
        role: 'user',
        content: userMsg.content,
        createdAt: userMsg.createdAt.toISOString(),
      },
      assistantMessage: {
        id: assistantMsg.id,
        conversationId,
        role: 'assistant',
        content: assistantMsg.content,
        createdAt: assistantMsg.createdAt.toISOString(),
      },
    };
  }

  /**
   * End a wellness conversation session
   */
  async endConversation(userId: string, conversationId: string): Promise<ConversationSummaryDto> {
    const conversation = await (this.prisma as any).conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Session not found');
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('Access denied. You do not own this wellness session.');
    }

    const updated = await (this.prisma as any).conversation.update({
      where: { id: conversationId },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
      },
    });

    if (this.metrics.activeConversations > 0) {
      this.metrics.activeConversations--;
    }

    return {
      id: updated.id,
      userId: updated.userId,
      title: updated.title,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      endedAt: updated.endedAt ? updated.endedAt.toISOString() : null,
    };
  }

  /**
   * Get usage metrics
   */
  getMetrics(): UsageMetricsDto {
    return { ...this.metrics };
  }
}
