import { Role } from '../constants/roles';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface AdminUserListItemDto {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  role: Role;
  status: UserStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt: string | null;
}

export interface AdminUserListResponseDto {
  success: boolean;
  users: AdminUserListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminUserDetailDto {
  user: AdminUserListItemDto;
  stats: {
    conversationCount: number;
    voiceSessionCount: number;
    wardRelationshipCount: number;
    guardianRelationshipCount: number;
    voluntaryCheckInCount: number;
  };
}

export interface AdminSystemStatsDto {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  usersByRole: {
    USER: number;
    GUARDIAN: number;
    ADMIN: number;
  };
  totalConversations: number;
  activeConversations: number;
  totalVoiceSessions: number;
  totalGuardianRelationships: number;
  activeGuardianRelationships: number;
  totalAuditLogs: number;
  systemUptimeSeconds: number;
}

export interface AdminSystemHealthDto {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  version: string;
  database: {
    connected: boolean;
    provider: string;
    latencyMs?: number;
  };
  security: {
    rbacEnforced: boolean;
    httpOnlyCookies: boolean;
    auditTrailActive: boolean;
    privacyBoundariesEnforced: boolean;
  };
  features: {
    googleOAuth: boolean;
    geminiLiveVoice: boolean;
    guardianNetwork: boolean;
    safetyCrisisResponse: boolean;
  };
}

export interface AdminAuditQueryDto {
  limit?: number;
  offset?: number;
  action?: string;
  userId?: string;
  search?: string;
}
