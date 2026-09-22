import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '@shared/constants/roles';
import { AuthSession, GoogleOAuthPayload } from '@shared/types/auth';
import { AuditAction } from '@shared/types/audit';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly memoryUsers = new Map<string, any>();
  private readonly memorySessions = new Map<string, AuthSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Validates Google OAuth payload, upserts User (defaulting to USER role),
   * creates Account link, generates Session, and records security audit trail.
   */
  async handleGoogleUser(
    googlePayload: GoogleOAuthPayload,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthSession> {
    if (!googlePayload.email || !googlePayload.sub) {
      throw new BadRequestException('Invalid Google OAuth payload: Missing email or sub claim');
    }

    const email = googlePayload.email.toLowerCase().trim();
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase().trim();

    // Server-side governance: Only server-configured email can be granted ADMIN
    const shouldBeAdmin = adminEmail && email === adminEmail;
    const assignedRole = shouldBeAdmin ? Role.ADMIN : Role.USER;

    try {
      // Find or create user via Prisma
      let user = await this.prisma.user.findUnique({
        where: { email },
      });

      let isNewUser = false;

      if (!user) {
        isNewUser = true;
        user = await this.prisma.user.create({
          data: {
            email,
            name: googlePayload.name || 'NIVA User',
            avatarUrl: googlePayload.picture || null,
            role: assignedRole,
            emailVerified: googlePayload.email_verified ? new Date() : null,
            lastLoginAt: new Date(),
          },
        });

        await this.auditService.logEvent({
          userId: user.id,
          action: AuditAction.USER_CREATED,
          entityType: 'User',
          entityId: user.id,
          metadata: { provider: 'google', initialRole: user.role },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });
      } else {
        // Update login timestamp and photo if changed
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            avatarUrl: googlePayload.picture || user.avatarUrl,
            name: googlePayload.name || user.name,
          },
        });
      }

      // Upsert linked federated account
      await this.prisma.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: googlePayload.sub,
          },
        },
        update: {
          updatedAt: new Date(),
        },
        create: {
          userId: user.id,
          type: 'oauth',
          provider: 'google',
          providerAccountId: googlePayload.sub,
        },
      });

      // Generate server session token (cryptographically strong random hex)
      const sessionToken = `niva_sess_${crypto.randomBytes(32).toString('hex')}`;
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await this.prisma.session.create({
        data: {
          sessionToken,
          userId: user.id,
          expires,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
      });

      await this.auditService.logEvent({
        userId: user.id,
        action: AuditAction.USER_LOGIN_SUCCESS,
        entityType: 'Session',
        metadata: { provider: 'google', isNewUser },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      const session: AuthSession = {
        token: sessionToken,
        expiresAt: expires.toISOString(),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role as Role,
        },
      };

      return session;
    } catch (error) {
      this.logger.warn(`PostgreSQL unavailable; using resilient in-memory session layer for demo`);
      return this.handleFallbackSession(googlePayload, assignedRole, meta);
    }
  }

  /**
   * Resilient session creation for live testing before PostgreSQL is started
   */
  private async handleFallbackSession(
    googlePayload: GoogleOAuthPayload,
    role: Role,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthSession> {
    const email = googlePayload.email.toLowerCase().trim();
    let existingUser = this.memoryUsers.get(email);

    if (!existingUser) {
      existingUser = {
        id: `usr_${crypto.randomBytes(8).toString('hex')}`,
        email,
        name: googlePayload.name || 'NIVA User',
        avatarUrl: googlePayload.picture || null,
        role,
        createdAt: new Date().toISOString(),
      };
      this.memoryUsers.set(email, existingUser);
    }

    const sessionToken = `niva_sess_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const session: AuthSession = {
      token: sessionToken,
      expiresAt,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        avatarUrl: existingUser.avatarUrl,
        role: existingUser.role,
      },
    };

    this.memorySessions.set(sessionToken, session);

    await this.auditService.logEvent({
      userId: existingUser.id,
      action: AuditAction.USER_LOGIN_SUCCESS,
      entityType: 'Session',
      metadata: { provider: 'google', mode: 'resilient_demo' },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return session;
  }

  /**
   * Validates a session token and returns the authenticated user
   */
  async validateSession(sessionToken: string): Promise<AuthSession | null> {
    if (!sessionToken) return null;

    try {
      const dbSession = await this.prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });

      if (!dbSession || dbSession.expires < new Date() || !dbSession.user.isActive) {
        return null;
      }

      return {
        token: dbSession.sessionToken,
        expiresAt: dbSession.expires.toISOString(),
        user: {
          id: dbSession.user.id,
          email: dbSession.user.email,
          name: dbSession.user.name,
          avatarUrl: dbSession.user.avatarUrl,
          role: dbSession.user.role as Role,
        },
      };
    } catch {
      const memSession = this.memorySessions.get(sessionToken);
      if (!memSession) return null;
      if (new Date(memSession.expiresAt) < new Date()) {
        this.memorySessions.delete(sessionToken);
        return null;
      }
      return memSession;
    }
  }

  /**
   * Destroys an active session
   */
  async logout(sessionToken: string, userId?: string): Promise<void> {
    try {
      await this.prisma.session.deleteMany({
        where: { sessionToken },
      });
    } catch {
      this.memorySessions.delete(sessionToken);
    }

    await this.auditService.logEvent({
      userId: userId || null,
      action: AuditAction.USER_LOGOUT,
      entityType: 'Session',
    });
  }
}
