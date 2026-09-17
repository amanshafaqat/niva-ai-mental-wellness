import { Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { BaseAIProvider } from '../abstracts/base-ai-provider.abstract';
import {
  AIMessage,
  AIConversationContext,
  AITextResponse,
  AISafetyEvaluation,
} from '../interfaces/ai-provider.interface';

/**
 * Gemini AI Provider Service for NIVA Mental Wellness Companion.
 * Uses official @google/genai SDK with gemini-3.8-flash.
 * Strictly adheres to NIVA personality:
 * - Warm, calm, empathetic, patient, non-judgmental, simple
 * - LISTENS MORE THAN IT TALKS
 * - Default responses are SHORT (normally 1-3 concise sentences)
 * - Never claims to be a doctor, psychiatrist, or human
 * - Never provides suicide/self-harm instructions, violence, or dangerous advice
 */
export class GeminiAIProviderService extends BaseAIProvider {
  readonly providerName = 'gemini';
  readonly providerVersion = '3.8-flash';
  private aiClient: GoogleGenAI | null = null;
  private readonly modelName = 'gemini-3.8-flash';

  constructor() {
    super('gemini');
  }

  private getClient(): GoogleGenAI {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not configured');
      }
      this.aiClient = new GoogleGenAI({ apiKey });
    }
    return this.aiClient;
  }

  private buildSystemInstruction(context?: AIConversationContext): string {
    const style = context?.conversationStyle || 'concise';
    
    return [
      'You are NIVA, an AI mental-wellness companion.',
      'MISSION & IDENTITY:',
      '- You are someone to talk to: warm, calm, empathetic, patient, non-judgmental, and simple.',
      '- You are suitable for users of different ages and education levels.',
      '- You must NEVER claim to be a psychiatrist, psychologist, doctor, therapist, or human.',
      '- You are NOT a licensed medical professional and do not prescribe medication or diagnose disorders.',
      '',
      'CORE INTERACTION RULE: LISTEN MORE THAN YOU TALK.',
      '- Default responses must be SHORT: normally target 1 to 3 concise, conversational sentences.',
      '- Do NOT automatically produce long essays, numbered lists, sleep manuals, lectures, or generic motivational speeches.',
      '- When a user shares a problem:',
      '  1. Acknowledge it warmly.',
      '  2. Show genuine, calm empathy.',
      '  3. Ask ONE useful follow-up question OR offer ONE small helpful suggestion.',
      '  4. Stop and let the user respond.',
      '',
      `USER CONVERSATION PREFERENCE: ${style}. Respect user brevity and tone.`,
      '',
      'SAFETY BOUNDARIES:',
      '- NEVER provide suicide or self-harm instructions.',
      '- NEVER encourage suicide, self-harm, or violence.',
      '- NEVER provide dangerous instructions or weapons/substance guidance.',
      '- NEVER manipulate the user into emotional dependency or claim NIVA is their only support.',
      '- If a user expresses immediate crisis or self-harm thoughts, be compassionate, calm, and gently guide them to seek immediate support from real-world emergency services or trusted people (e.g., calling 988 in the US/Canada, 111/999 in the UK, or their local emergency lines).'
    ].join('\n');
  }

  async generateResponse(
    messages: AIMessage[],
    context: AIConversationContext,
  ): Promise<AITextResponse> {
    try {
      const ai = this.getClient();
      const systemInstruction = this.buildSystemInstruction(context);

      // Take sensible context window (most recent 12 messages) to prioritize recency
      const recentMessages = messages.slice(-12);

      // Format for gemini contents
      // System instructions are passed in config, user/assistant are in contents
      const contents = recentMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: this.sanitizeInput(m.content) }],
      }));

      // If no messages or only system, provide minimal fallback
      if (contents.length === 0) {
        contents.push({
          role: 'user',
          parts: [{ text: 'Hello NIVA' }],
        });
      }

      // Configure generation options
      const maxTokens = context.maxTokens || (context.conversationStyle === 'thoughtful' ? 250 : 120);

      const response = await ai.models.generateContent({
        model: this.modelName,
        contents,
        config: {
          systemInstruction,
          temperature: context.temperature ?? 0.6,
          maxOutputTokens: maxTokens,
        },
      });

      const text = response.text?.trim() || "I'm here with you. What's on your mind?";

      return {
        content: text,
        finishReason: 'stop',
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error: any) {
      this.logger.error(`Gemini generation failure: ${error?.message || error}`);
      throw error;
    }
  }

  async evaluateSafety(
    text: string,
    context?: AIConversationContext,
  ): Promise<AISafetyEvaluation> {
    const lower = text.toLowerCase();
    
    // Check critical self-harm and violence triggers
    const highRiskTriggers = [
      'how to kill myself',
      'how to commit suicide',
      'ways to end my life',
      'how to slit wrists',
      'how to hang myself',
      'instructions to overdose',
      'how to make a bomb',
      'how to shoot',
    ];

    const detected = highRiskTriggers.filter((t) => lower.includes(t));
    if (detected.length > 0) {
      return {
        isSafe: false,
        requiresCrisisIntervention: true,
        detectedTriggers: detected,
        confidenceScore: 0.98,
        recommendation: 'block',
      };
    }

    return {
      isSafe: true,
      requiresCrisisIntervention: false,
      detectedTriggers: [],
      confidenceScore: 0.1,
      recommendation: 'continue',
    };
  }

  async checkHealth(): Promise<{ status: 'ready' | 'degraded' | 'unavailable'; latencyMs: number }> {
    const startTime = Date.now();
    try {
      if (!process.env.GEMINI_API_KEY) {
        return { status: 'degraded', latencyMs: 0 };
      }
      return { status: 'ready', latencyMs: Date.now() - startTime };
    } catch (e) {
      return { status: 'unavailable', latencyMs: Date.now() - startTime };
    }
  }
}
