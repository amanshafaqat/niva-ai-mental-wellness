import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditLogEntry } from '@shared/types/audit';

export interface CreateAuditLogParams {
  userId?: string | null;
  action: AuditAction | string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  // In-memory circular buffer fallback if PostgreSQL is temporarily offline during development
  private readonly memoryLogFallback: AuditLogEntry[] = [];
  private readonly MAX_FALLBACK_LOGS = 200;

  constructor(private readonly prisma: PrismaService) {}

  async logEvent(params: CreateAuditLogParams): Promise<AuditLogEntry> {
    const timestamp = new Date().toISOString();
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: params.userId || null,
      action: params.action as AuditAction,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: this.sanitizeMetadata(params.metadata),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      timestamp,
    };

    // Structured logging for SIEM / console
    this.logger.log(
      `[SECURITY AUDIT] action=${entry.action} userId=${entry.userId || 'anonymous'} entity=${entry.entityType || 'none'}`,
    );

    try {
      const saved = await this.prisma.auditLog.create({
        data: {
          id: entry.id,
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: entry.metadata as any,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          timestamp: new Date(entry.timestamp),
        },
      });

      return {
        id: saved.id,
        userId: saved.userId,
        action: saved.action as AuditAction,
        entityType: saved.entityType || undefined,
        entityId: saved.entityId || undefined,
        metadata: (saved.metadata as Record<string, unknown>) || undefined,
        ipAddress: saved.ipAddress || undefined,
        userAgent: saved.userAgent || undefined,
        timestamp: saved.timestamp.toISOString(),
      };
    } catch {
      // Store in memory buffer if database is unavailable
      this.memoryLogFallback.unshift(entry);
      if (this.memoryLogFallback.length > this.MAX_FALLBACK_LOGS) {
        this.memoryLogFallback.pop();
      }
      return entry;
    }
  }

  async getRecentLogs(limit = 50, offset = 0): Promise<{ logs: AuditLogEntry[]; total: number }> {
    try {
      const [records, count] = await Promise.all([
        this.prisma.auditLog.findMany({
          take: limit,
          skip: offset,
          orderBy: { timestamp: 'desc' },
        }),
        this.prisma.auditLog.count(),
      ]);

      const logs: AuditLogEntry[] = records.map((r) => ({
        id: r.id,
        userId: r.userId,
        action: r.action as AuditAction,
        entityType: r.entityType || undefined,
        entityId: r.entityId || undefined,
        metadata: (r.metadata as Record<string, unknown>) || undefined,
        ipAddress: r.ipAddress || undefined,
        userAgent: r.userAgent || undefined,
        timestamp: r.timestamp.toISOString(),
      }));

      return { logs, total: count };
    } catch {
      return {
        logs: this.memoryLogFallback.slice(offset, offset + limit),
        total: this.memoryLogFallback.length,
      };
    }
  }

  private sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!metadata) return undefined;
    const sanitized = { ...metadata };
    const sensitiveKeys = ['password', 'token', 'secret', 'accessToken', 'refreshToken', 'idToken'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
