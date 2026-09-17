/**
 * NIVA Conversation & Wellness Session Shared Types
 * Phase 3: AI Conversation Engine + Text Wellness Sessions
 */

export type ConversationStatus = 'ACTIVE' | 'ENDED';

export type MessageRole = 'user' | 'assistant' | 'system';

export type ResponseStyle = 'SHORT' | 'BALANCED' | 'DETAILED';

export type ConversationPreference = 'JUST_LISTEN' | 'LISTEN_AND_RESPOND' | 'HELP_ME_SOLVE';

export interface UserPreferencesDto {
  responseStyle: ResponseStyle;
  conversationPreference: ConversationPreference;
}

export interface ConversationMessageDto {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ConversationSummaryDto {
  id: string;
  userId: string;
  title: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  messageCount?: number;
  lastMessageSnippet?: string | null;
}

export interface ConversationDetailDto extends ConversationSummaryDto {
  messages: ConversationMessageDto[];
}

export interface CreateConversationDto {
  title?: string;
}

export interface SendMessageDto {
  content: string;
}

export interface UsageMetricsDto {
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  totalAiRequests: number;
}
