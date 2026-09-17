export enum AuditAction {
  // Phase 1 Actions
  USER_LOGIN_SUCCESS = 'USER_LOGIN_SUCCESS',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  ROLE_VERIFIED = 'ROLE_VERIFIED',
  RBAC_ACCESS_DENIED = 'RBAC_ACCESS_DENIED',
  CONSENT_GRANTED = 'CONSENT_GRANTED',
  CONSENT_REVOKED = 'CONSENT_REVOKED',
  ADMIN_ACCESS_ATTEMPT = 'ADMIN_ACCESS_ATTEMPT',
  SAFETY_EVENT_TRIGGERED = 'SAFETY_EVENT_TRIGGERED',

  // Phase 2 Canonical Authentication Audit Actions
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ROLE_CHANGE_REJECTED = 'ROLE_CHANGE_REJECTED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
}

export interface AuditLogEntry {
  id: string;
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}
