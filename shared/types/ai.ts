/**
 * NIVA AI Provider Abstraction Interface
 * Decouples NIVA core logic from any specific AI model or provider.
 * Prepared for Phase 2 (Text Conversational Engine) and Phase 3 (Realtime Voice).
 */

export type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIMessage {
  role: AIMessageRole;
  content: string;
  name?: string;
  timestamp?: string;
}

export interface AIConversationContext {
  userId: string;
  conversationId?: string;
  language?: string;
  conversationStyle?: 'gentle' | 'concise' | 'thoughtful' | 'structured';
  safetyDirectives?: string[];
  maxTokens?: number;
  temperature?: number;
}

export interface AITextResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'safety' | 'error';
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  safetyFlags?: {
    flagged: boolean;
    categories?: string[];
    severity?: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface AIVoiceSessionToken {
  sessionId: string;
  connectionUrl: string;
  ephemeralToken: string;
  expiresAt: string;
  audioConfig: {
    sampleRate: number;
    channels: number;
    codec: string;
  };
}

export interface AISafetyEvaluation {
  isSafe: boolean;
  requiresCrisisIntervention: boolean;
  detectedTriggers: string[];
  confidenceScore: number;
  recommendation?: 'continue' | 'deflect' | 'escalate_crisis_resources' | 'block';
}

/**
 * Clean AI Provider Interface
 * Supports swappable providers (Google Gemini, OpenAI, Claude, Local models)
 */
export interface AIProvider {
  readonly providerName: string;
  readonly providerVersion: string;

  /**
   * Generates supportive text response given conversation history and context
   */
  generateResponse(
    messages: AIMessage[],
    context: AIConversationContext,
  ): Promise<AITextResponse>;

  /**
   * Prepares and provisions an ephemeral token for realtime voice-to-voice interaction (Phase 3)
   */
  createRealtimeVoiceSession?(
    userId: string,
    context: AIConversationContext,
  ): Promise<AIVoiceSessionToken>;

  /**
   * Dedicated safety & risk detection evaluator
   */
  evaluateSafety(
    text: string,
    context?: AIConversationContext,
  ): Promise<AISafetyEvaluation>;

  /**
   * Health check for the AI provider service
   */
  checkHealth(): Promise<{ status: 'ready' | 'degraded' | 'unavailable'; latencyMs: number }>;
}
