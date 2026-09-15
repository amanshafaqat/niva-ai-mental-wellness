import { Logger } from '@nestjs/common';
import {
  AIProvider,
  AIMessage,
  AIConversationContext,
  AITextResponse,
  AIVoiceSessionToken,
  AISafetyEvaluation,
} from '../interfaces/ai-provider.interface';

/**
 * Abstract Base AI Provider
 * Handles common telemetry, error normalization, and standard provider behavior.
 */
export abstract class BaseAIProvider implements AIProvider {
  protected readonly logger: Logger;
  abstract readonly providerName: string;
  abstract readonly providerVersion: string;

  constructor(providerName: string) {
    this.logger = new Logger(`AIProvider:${providerName}`);
  }

  abstract generateResponse(
    messages: AIMessage[],
    context: AIConversationContext,
  ): Promise<AITextResponse>;

  abstract evaluateSafety(
    text: string,
    context?: AIConversationContext,
  ): Promise<AISafetyEvaluation>;

  abstract checkHealth(): Promise<{
    status: 'ready' | 'degraded' | 'unavailable';
    latencyMs: number;
  }>;

  createRealtimeVoiceSession?(
    userId: string,
    context: AIConversationContext,
  ): Promise<AIVoiceSessionToken>;

  protected sanitizeInput(input: string): string {
    // Strip control characters while preserving unicode & emotional indicators
    return input.trim();
  }
}
