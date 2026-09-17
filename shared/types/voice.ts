/**
 * NIVA Realtime Voice-to-Voice Shared Types (Phase 4)
 * Native Audio Realtime Voice Architecture
 */

export type VoiceConnectionState =
  | 'DISCONNECTED'
  | 'REQUESTING_MIC'
  | 'CONNECTING'
  | 'LISTENING'
  | 'SPEAKING'
  | 'MUTED'
  | 'ENDED'
  | 'ERROR';

export type VoiceSessionStatus = 'INITIALIZING' | 'ACTIVE' | 'ENDED' | 'FAILED';

export interface VoiceSessionSummaryDto {
  id: string;
  userId: string;
  conversationId: string;
  status: VoiceSessionStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
}

export interface VoiceTicketResponseDto {
  ticket: string;
  conversationId: string;
  voiceSessionId: string;
  expiresAt: number;
  model: string;
  voiceName: string;
}

export interface VoiceUsageMetricsDto {
  totalVoiceSessions: number;
  activeVoiceSessions: number;
  totalVoiceDurationSeconds: number;
  totalInterruptions: number;
  connectionFailures: number;
}

/**
 * WebSocket Protocol Events between Browser Client and Server Relay
 */
export type ClientVoiceMessage =
  | { type: 'AUDIO_CHUNK'; audio: string } // base64 PCM 16kHz audio
  | { type: 'INTERRUPT' } // user interrupted assistant
  | { type: 'MUTE'; muted: boolean }
  | { type: 'END_SESSION' };

export type ServerVoiceMessage =
  | { type: 'CONNECTED'; voiceSessionId: string; conversationId: string }
  | { type: 'AUDIO_CHUNK'; audio: string } // base64 PCM 24kHz audio from Gemini
  | { type: 'INTERRUPTED' } // NIVA was interrupted, halt client output playback
  | { type: 'TURN_COMPLETE' }
  | { type: 'USER_TRANSCRIPT'; text: string } // transient transcript snippet
  | { type: 'NIVA_TRANSCRIPT'; text: string } // transient transcript snippet
  | { type: 'STATE_CHANGE'; state: VoiceConnectionState }
  | { type: 'ERROR'; message: string; fatal?: boolean }
  | { type: 'SESSION_ENDED'; durationSeconds: number };
