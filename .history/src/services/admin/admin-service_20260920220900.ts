/**
 * NIVA Phase 7: Admin Service
 * Server-authoritative administration, user governance, audit log queries, and system telemetry.
 * Strictly checks Role.ADMIN and enforces security boundaries.
 */

import { getPrismaClient, isDatabaseConnected } from '../../lib/prisma';
import { Role } from '../../../shared/constants/roles';
import {
  AdminUserListItemDto,
  AdminUserListResponseDto,
  AdminUserDetailDto,
  AdminSystemStatsDto,
  AdminSystemHealthDto,
  UserStatus,
} from '../../../shared/types/admin';
import { AuditLogEntry, AuditAction } from '../../../shared/types/audit';

export interface AdminUserQueryOptions {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

function normalizeStatusValue(value: string): UserStatus | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'SUSPENDED' || normalized === 'DEACTIVATED') {
    return normalized as UserStatus;
  }
  return null;
}

function normalizeRoleValue(value: string): Role | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === Role.USER || normalized === Role.GUARDIAN || normalized === Role.ADMIN) {
    return normalized as Role;
  }
  return null;
}

/**
 * List all registered users with server-side pagination, search, and filtering.
 * Sensitive fields (passwords, tokens, OAuth credentials) are strictly excluded.
 */
export async function getAdminUsersList(
  options: AdminUserQueryOptions = {},
  fallbackUsers: any[] = [],
): Promise<AdminUserListResponseDto> {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const skip = (page - 1) * limit;

  const isDbReady = await isDatabaseConnected();
  if (isDbReady) {
    const prisma = getPrismaClient();
    const whereClause: any = {};

    if (options.role && Object.values(Role).includes(options.role as Role)) {
      whereClause.role = options.role as Role;
    }

    if (options.status) {
      whereClause.status = options.status;
    }

    if (options.search && options.search.trim().length > 0) {
      const search = options.search.trim();
      whereClause.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, dbUsers] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          status: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
      }),
    ]);

    const users: AdminUserListItemDto[] = dbUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      role: u.role as Role,
      status: (u.status as UserStatus) || 'ACTIVE',
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    }));

    return {
      success: true,
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // Fallback for memory users store
  let filtered = [...fallbackUsers];
  if (options.role) {
    filtered = filtered.filter((u) => u.role === options.role);
  }
  if (options.status) {
    filtered = filtered.filter((u) => u.status === options.status);
  }
  if (options.search && options.search.trim().length > 0) {
    const search = options.search.trim().toLowerCase();
    filtered = filtered.filter(
      (u) =>
        (u.email && u.email.toLowerCase().includes(search)) ||
        (u.name && u.name.toLowerCase().includes(search)),
    );
  }

  const total = filtered.length;
  const paged = filtered.slice(skip, skip + limit);

  const users: AdminUserListItemDto[] = paged.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name || null,
    avatarUrl: u.avatarUrl || null,
    role: (u.role as Role) || Role.USER,
    status: (u.status as UserStatus) || 'ACTIVE',
    isActive: u.isActive !== false,
    createdAt: u.createdAt || new Date().toISOString(),
    updatedAt: u.updatedAt || new Date().toISOString(),
    lastLoginAt: u.lastLoginAt || null,
  }));

  return {
    success: true,
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Get individual user detail and high-level activity telemetry.
 * Protects user privacy: Conversation messages, transcripts, and crisis scores are NOT returned.
 */
export async function getAdminUserDetail(
  targetUserId: string,
  fallbackUsers: any[] = [],
): Promise<AdminUserDetailDto | null> {
  const isDbReady = await isDatabaseConnected();
  if (isDbReady) {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            conversations: true,
            voiceSessions: true,
            wardRelationships: true,
            guardianRelationships: true,
            voluntaryCheckIns: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role as Role,
        status: (user.status as UserStatus) || 'ACTIVE',
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      },
      stats: {
        conversationCount: user._count.conversations,
        voiceSessionCount: user._count.voiceSessions,
        wardRelationshipCount: user._count.wardRelationships,
        guardianRelationshipCount: user._count.guardianRelationships,
        voluntaryCheckInCount: user._count.voluntaryCheckIns,
      },
    };
  }

  const found = fallbackUsers.find((u) => u.id === targetUserId);
  if (!found) return null;

  return {
    user: {
      id: found.id,
      email: found.email,
      name: found.name || null,
      avatarUrl: found.avatarUrl || null,
      role: (found.role as Role) || Role.USER,
      status: (found.status as UserStatus) || 'ACTIVE',
      isActive: found.isActive !== false,
      createdAt: found.createdAt || new Date().toISOString(),
      updatedAt: found.updatedAt || new Date().toISOString(),
      lastLoginAt: found.lastLoginAt || null,
    },
    stats: {
      conversationCount: 0,
      voiceSessionCount: 0,
      wardRelationshipCount: 0,
      guardianRelationshipCount: 0,
      voluntaryCheckInCount: 0,
    },
  };
}

/**
 * Update user account status (ACTIVE, SUSPENDED, DEACTIVATED).
 */
export async function updateAdminUserStatus(
  targetUserId: string,
  newStatus: UserStatus | string,
  adminUserId: string,
  memoryUsersStore?: Map<string, any>,
): Promise<AdminUserListItemDto> {
  const normalizedStatus = normalizeStatusValue(String(newStatus));
  const allowedStatuses: UserStatus[] = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];
  if (!normalizedStatus || !allowedStatuses.includes(normalizedStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Allowed values: ${allowedStatuses.join(', ')}`);
  }

  // Prevent an admin from suspending or deactivating their own account
  if (targetUserId === adminUserId && normalizedStatus !== 'ACTIVE') {
    throw new Error('Self-governance violation: Administrators cannot suspend or deactivate their own account.');
  }

  const isDbReady = await isDatabaseConnected();
  if (isDbReady) {
    const prisma = getPrismaClient();
    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        status: normalizedStatus,
        isActive: normalizedStatus === 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    if (memoryUsersStore && memoryUsersStore.has(targetUserId)) {
      const mem = memoryUsersStore.get(targetUserId);
      mem.status = normalizedStatus;
      mem.isActive = normalizedStatus === 'ACTIVE';
      mem.updatedAt = updated.updatedAt.toISOString();
    }

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      role: updated.role as Role,
      status: updated.status as UserStatus,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      lastLoginAt: updated.lastLoginAt ? updated.lastLoginAt.toISOString() : null,
    };
  }

  if (memoryUsersStore && memoryUsersStore.has(targetUserId)) {
    const mem = memoryUsersStore.get(targetUserId);
    mem.status = normalizedStatus;
    mem.isActive = normalizedStatus === 'ACTIVE';
    mem.updatedAt = new Date().toISOString();
    return {
      id: mem.id,
      email: mem.email,
      name: mem.name,
      avatarUrl: mem.avatarUrl,
      role: mem.role,
      status: mem.status,
      isActive: mem.isActive,
      createdAt: mem.createdAt || new Date().toISOString(),
      updatedAt: mem.updatedAt,
      lastLoginAt: mem.lastLoginAt || null,
    };
  }

  throw new Error(`User not found: ${targetUserId}`);
}

/**
 * Update user role (USER, GUARDIAN, ADMIN) with self-demotion protection.
 */
export async function updateAdminUserRole(
  targetUserId: string,
  newRole: Role | string,
  adminUserId: string,
  memoryUsersStore?: Map<string, any>,
): Promise<AdminUserListItemDto> {
  const normalizedRole = normalizeRoleValue(String(newRole));
  if (!normalizedRole) {
    throw new Error(`Invalid role: ${newRole}. Must be USER, GUARDIAN, or ADMIN.`);
  }

  // Prevent an admin from stripping their own admin role
  if (targetUserId === adminUserId && normalizedRole !== Role.ADMIN) {
    throw new Error('Self-governance violation: Administrators cannot revoke their own administrator role.');
  }

  const isDbReady = await isDatabaseConnected();
  if (isDbReady) {
    const prisma = getPrismaClient();
    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: normalizedRole },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    if (memoryUsersStore && memoryUsersStore.has(targetUserId)) {
      const mem = memoryUsersStore.get(targetUserId);
      mem.role = normalizedRole;
      mem.updatedAt = updated.updatedAt.toISOString();
    }

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      role: updated.role as Role,
      status: updated.status as UserStatus,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      lastLoginAt: updated.lastLoginAt ? updated.lastLoginAt.toISOString() : null,
    };
  }

  if (memoryUsersStore && memoryUsersStore.has(targetUserId)) {
    const mem = memoryUsersStore.get(targetUserId);
    mem.role = normalizedRole;
    mem.updatedAt = new Date().toISOString();
    return {
      id: mem.id,
      email: mem.email,
      name: mem.name,
      avatarUrl: mem.avatarUrl,
      role: mem.role,
      status: mem.status,
      isActive: mem.isActive,
      createdAt: mem.createdAt || new Date().toISOString(),
      updatedAt: mem.updatedAt,
      lastLoginAt: mem.lastLoginAt || null,
    };
  }

  throw new Error(`User not found: ${targetUserId}`);
}

/**
 * Platform high-level operational statistics
 */
export async function getAdminSystemStats(
  fallbackUsers: any[] = [],
  auditLogsCount = 0,
  startTime = Date.now(),
): Promise<AdminSystemStatsDto> {
  const isDbReady = await isDatabaseConnected();
  if (isDbReady) {
    const prisma = getPrismaClient();

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      usersByUserRole,
      usersByGuardianRole,
      usersByAdminRole,
      totalConversations,
      activeConversations,
      totalVoiceSessions,
      totalGuardianRelationships,
      activeGuardianRelationships,
      totalAuditLogs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count({ where: { role: Role.USER } }),
      prisma.user.count({ where: { role: Role.GUARDIAN } }),
      prisma.user.count({ where: { role: Role.ADMIN } }),
      prisma.conversation.count(),
      prisma.conversation.count({ where: { status: 'ACTIVE' } }),
      prisma.voiceSession.count(),
      prisma.guardianRelationship.count(),
      prisma.guardianRelationship.count({ where: { status: 'ACTIVE' } }),
      prisma.auditLog.count(),
    ]);

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      usersByRole: {
        USER: usersByUserRole,
        GUARDIAN: usersByGuardianRole,
        ADMIN: usersByAdminRole,
      },
      totalConversations,
      activeConversations,
      totalVoiceSessions,
      totalGuardianRelationships,
      activeGuardianRelationships,
      totalAuditLogs,
      systemUptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    };
  }

  const totalUsers = fallbackUsers.length;
  const activeUsers = fallbackUsers.filter((u) => u.status === 'ACTIVE' || u.isActive !== false).length;
  const suspendedUsers = fallbackUsers.filter((u) => u.status === 'SUSPENDED').length;

  return {
    totalUsers,
    activeUsers,
    suspendedUsers,
    usersByRole: {
      USER: fallbackUsers.filter((u) => u.role === Role.USER).length,
      GUARDIAN: fallbackUsers.filter((u) => u.role === Role.GUARDIAN).length,
      ADMIN: fallbackUsers.filter((u) => u.role === Role.ADMIN).length,
    },
    totalConversations: 0,
    activeConversations: 0,
    totalVoiceSessions: 0,
    totalGuardianRelationships: 0,
    activeGuardianRelationships: 0,
    totalAuditLogs: auditLogsCount,
    systemUptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
  };
}

/**
 * Filtered audit logs query with action, user, and search parameters.
 */
export async function queryAdminAuditLogs(
  query: { action?: string; userId?: string; limit?: number; search?: string },
  fallbackAuditLogs: AuditLogEntry[] = [],
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
  const isDbReady = await isDatabaseConnected();

  if (isDbReady) {
    const prisma = getPrismaClient();
    const whereClause: any = {};

    if (query.action) {
      whereClause.action = query.action;
    }
    if (query.userId) {
      whereClause.userId = query.userId;
    }
    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim();
      whereClause.OR = [
        { action: { contains: term, mode: 'insensitive' } },
        { entityType: { contains: term, mode: 'insensitive' } },
        { entityId: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, dbLogs] = await Promise.all([
      prisma.auditLog.count({ where: whereClause }),
      prisma.auditLog.findMany({
        where: whereClause,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    const logs: AuditLogEntry[] = dbLogs.map((l) => ({
      id: l.id,
      userId: l.userId,
      action: l.action as AuditAction,
      entityType: l.entityType || undefined,
      entityId: l.entityId || undefined,
      metadata: (l.metadata as Record<string, unknown>) || undefined,
      ipAddress: l.ipAddress || undefined,
      userAgent: l.userAgent || undefined,
      timestamp: l.timestamp.toISOString(),
    }));

    return { logs, total };
  }

  let filtered = [...fallbackAuditLogs];
  if (query.action) {
    filtered = filtered.filter((l) => l.action === query.action);
  }
  if (query.userId) {
    filtered = filtered.filter((l) => l.userId === query.userId);
  }
  if (query.search && query.search.trim().length > 0) {
    const term = query.search.trim().toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.action.toLowerCase().includes(term) ||
        (l.entityType && l.entityType.toLowerCase().includes(term)) ||
        (l.entityId && l.entityId.toLowerCase().includes(term)),
    );
  }

  return {
    logs: filtered.slice(0, limit),
    total: filtered.length,
  };
}
