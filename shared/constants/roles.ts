/**
 * NIVA Mental Wellness Companion - Shared Roles & Permissions
 * Phase 4.1 Architecture
 */

export enum Role {
  USER = 'USER',
  GUARDIAN = 'GUARDIAN',
  ADMIN = 'ADMIN',
}

export interface RolePermission {
  role: Role;
  displayName: string;
  description: string;
  permissions: string[];
}

export const ROLE_PERMISSIONS: Record<Role, RolePermission> = {
  [Role.USER]: {
    role: Role.USER,
    displayName: 'Wellness Companion User',
    description: 'Standard end-user with personal conversational wellness access and strict data privacy',
    permissions: [
      'wellness:read_own',
      'wellness:write_own',
      'conversation:read_own',
      'conversation:write_own',
      'guardian:grant_consent',
      'guardian:revoke_consent',
      'profile:manage_own',
    ],
  },
  [Role.GUARDIAN]: {
    role: Role.GUARDIAN,
    displayName: 'Authorized Guardian',
    description: 'Trusted family member or guardian with explicitly consented, non-invasive safety oversight',
    permissions: [
      'guardian:view_consented_summary',
      'guardian:receive_safety_alerts',
      'guardian:manage_relationship',
    ],
  },
  [Role.ADMIN]: {
    role: Role.ADMIN,
    displayName: 'Platform Administrator',
    description: 'System infrastructure, security audits, and platform operations with governed access',
    permissions: [
      'system:view_health',
      'system:manage_platform',
      'audit:read_logs',
      'safety:monitor_telemetry',
    ],
  },
};
