export { Role, ROLE_PERMISSIONS } from '@shared/constants/roles';
export type { User, UserProfileResponse } from '@shared/types/user';
export type { AuthSession, AuthResponse, GoogleOAuthPayload } from '@shared/types/auth';
export type { AuditAction, AuditLogEntry } from '@shared/types/audit';
export type { AIProvider, AIMessage, AIConversationContext } from '@shared/types/ai';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  phase: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  database: {
    connected: boolean;
    provider: string;
  };
  features: {
    rbacEnabled: boolean;
    googleAuthReady: boolean;
    aiProviderReady: boolean;
    auditLoggingEnabled: boolean;
  };
}
