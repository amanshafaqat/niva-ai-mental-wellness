import { Injectable } from '@nestjs/common';
import { BaseAIProvider } from '../abstracts/base-ai-provider.abstract';
import {
  AIMessage,
  AIConversationContext,
  AITextResponse,
  AIVoiceSessionToken,
  AISafetyEvaluation,
} from '../interfaces/ai-provider.interface';

/**
 * Phase 1 Integration Stub Provider
 * Satisfies the AIProvider contract without fabricating conversational responses.
 * Ready for Phase 2 model attachment.
 */
@Injectable()
export class StubAIProviderService extends BaseAIProvider {
  readonly providerName = 'niva-ai-abstraction-stub';
  readonly providerVersion = '1.0.0-phase1';

  constructor() {
    super('StubProvider');
    this.logger.log('AI Provider Abstraction initialized. Ready for Phase 2 model integration.');
  }

  async generateResponse(
    messages: AIMessage[],
    context: AIConversationContext,
  ): Promise<AITextResponse> {
    this.logger.debug(
      `generateResponse called for user=${context.userId}, messageCount=${messages.length}. (Awaiting Phase 2 conversational engine)`,
    );

    return {
      content:
        '[Phase 1 System Notice: AI provider abstraction active. Production conversational models will be linked in Phase 2.]',
      finishReason: 'stop',
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }

  async evaluateSafety(
    text: string,
    context?: AIConversationContext,
  ): Promise<AISafetyEvaluation> {
    this.logger.debug(`evaluateSafety called for textLength=${text.length}`);

    // Conservative baseline evaluation: safe by default, flags zero triggers in stub mode
    return {
      isSafe: true,
      requiresCrisisIntervention: false,
      detectedTriggers: [],
      confidenceScore: 1.0,
      recommendation: 'continue',
    };
  }

  async createRealtimeVoiceSession(
    userId: string,
    context: AIConversationContext,
  ): Promise<AIVoiceSessionToken> {
    this.logger.debug(`createRealtimeVoiceSession called for userId=${userId}`);
    return {
      sessionId: `stub-voice-${Date.now()}`,
      connectionUrl: 'wss://api.niva.internal/voice/stream',
      ephemeralToken: 'phase-1-voice-token-stub',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      audioConfig: {
        sampleRate: 24000,
        channels: 1,
        codec: 'pcm16',
      },
    };
  }

  async checkHealth(): Promise<{
    status: 'ready' | 'degraded' | 'unavailable';
    latencyMs: number;
  }> {
    return {
      status: 'ready',
      latencyMs: 1,
    };
  }
}
