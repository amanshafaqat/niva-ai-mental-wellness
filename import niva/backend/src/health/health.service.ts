import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthCheckResult {
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

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResult> {
    let dbConnected = false;
    try {
      // Light query to verify connection
      await this.prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    return {
      status: 'ok',
      service: 'niva-backend',
      phase: 'Phase 1 - Architecture & Security Foundation',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: dbConnected,
        provider: 'PostgreSQL (Prisma ORM)',
      },
      features: {
        rbacEnabled: true,
        googleAuthReady: Boolean(process.env.GOOGLE_CLIENT_ID),
        aiProviderReady: true,
        auditLoggingEnabled: true,
      },
    };
  }
}
