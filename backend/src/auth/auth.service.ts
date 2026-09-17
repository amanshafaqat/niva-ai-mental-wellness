import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '@shared/constants/roles';
import { AuthSession, GoogleOAuthPayload } from '@shared/types/auth';
import { AuditAction } from '@shared/types/audit';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Cryptographically validates an incoming OAuth state parameter against the expected state cookie.
   * Employs timingSafeEqual to guard against timing analysis attacks.
   */
  validateOAuthState(
    incomingState?: string,
    expectedState?: string,
  ): { valid: boolean; reason?: string } {
    if (!incomingState || typeof incomingState !== 'string' || !incomingState.trim()) {
      return { valid: false, reason: 'MISSING_OAUTH_STATE' };
    }
    if (!expectedState || typeof expectedState !== 'string' || !expectedState.trim()) {
      return { valid: false, reason: 'MISSING_EXPECTED_STATE_COOKIE' };
    }

    const incomingBuf = Buffer.from(incomingState);
    const expectedBuf = Buffer.from(expectedState);

    if (incomingBuf.length !== expectedBuf.length) {
      return { valid: false, reason: 'STATE_MISMATCH' };
    }

    const matches = crypto.timingSafeEqual(incomingBuf, expectedBuf);
    if (!matches) {
      return { valid: false, reason: 'STATE_MISMATCH' };
    }

    return { valid: true };
  }

  /**
   * Lazily instantiates the Google OAuth2 client with server configuration
   */
  private getOAuthClient(redirectUriOverride?: string): OAuth2Client {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
      redirectUriOverride ||
      process.env.GOOGLE_CALLBACK_URL ||
      'http://localhost:3000/api/auth/google/callback';

    return new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  /**
   * Exchanges an authorization code received from Google's OAuth consent redirect
   * for access & ID tokens, extracts verified identity claims, and establishes session.
   */
  async exchangeAuthorizationCode(
    code: string,
    redirectUri?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthSession> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      await this.auditService.logEvent({
        action: AuditAction.LOGIN_FAILURE,
        entityType: 'OAuth',
        metadata: {
          reason: 'GOOGLE_CREDENTIALS_UNCONFIGURED',
          message: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in server environment',
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new BadRequestException(
        'Google OAuth credentials are not fully configured on the server. Please provide GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      );
    }

    try {
      const oauthClient = this.getOAuthClient(redirectUri);
      const { tokens } = await oauthClient.getToken(code);

      if (!tokens.id_token) {
        throw new UnauthorizedException('Google token exchange did not return an ID token');
      }

      // Cryptographically verify ID token
      const ticket = await oauthClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        throw new UnauthorizedException('Invalid Google ID token payload');
      }

      const googlePayload: GoogleOAuthPayload = {
        sub: payload.sub,
        email: payload.email,
        email_verified: Boolean(payload.email_verified),
        name: payload.name,
        picture: payload.picture,
        given_name: payload.given_name,
        family_name: payload.family_name,
      };

      return await this.handleGoogleUser(googlePayload, meta);
    } catch (error: any) {
      this.logger.error(`Google authorization code exchange failed: ${error.message}`);
      await this.auditService.logEvent({
        action: AuditAction.LOGIN_FAILURE,
        entityType: 'OAuth',
        metadata: {
          reason: 'CODE_EXCHANGE_FAILED',
          error: error.message,
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new UnauthorizedException(`Google authentication failed: ${error.message}`);
    }
  }

  /**
   * Cryptographically verifies a Google ID Token (e.g., from Google One Tap or GIS)
   */
  async verifyGoogleIdToken(
    idToken: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthSession> {
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      throw new BadRequestException(
        'GOOGLE_CLIENT_ID is not configured in server environment.',
      );
    }

    try {
      const oauthClient = this.getOAuthClient();
      const ticket = await oauthClient.verifyIdToken({
        idToken,
        audience: clientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        throw new UnauthorizedException('Invalid Google ID token claims');
      }

      const googlePayload: GoogleOAuthPayload = {
        sub: payload.sub,
        email: payload.email,
        email_verified: Boolean(payload.email_verified),
        name: payload.name,
        picture: payload.picture,
        given_name: payload.given_name,
        family_name: payload.family_name,
      };

      return await this.handleGoogleUser(googlePayload, meta);
    } catch (error: any) {
      this.logger.error(`Google ID token verification failed: ${error.message}`);
      await this.auditService.logEvent({
        action: AuditAction.LOGIN_FAILURE,
        entityType: 'Token',
        metadata: { reason: 'ID_TOKEN_VERIFICATION_FAILED', error: error.message },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new UnauthorizedException(`Invalid Google ID token: ${error.message}`);
    }
  }

  /**
   * Validates Google OAuth payload, upserts User (defaulting strictly to USER role),
   * creates federated Account link, generates server Session, and records security audit trail.
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

    // Server-side governance: Only server-configured email can be granted ADMIN.
    // All other incoming Google accounts strictly receive the USER role.
    const shouldBeAdmin = Boolean(adminEmail && email === adminEmail);
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
            status: 'ACTIVE',
            isActive: true,
            emailVerified: googlePayload.email_verified ? new Date() : null,
            lastLoginAt: new Date(),
          },
        });

        // Audit log account creation
        await this.auditService.logEvent({
          userId: user.id,
          action: AuditAction.ACCOUNT_CREATED,
          entityType: 'User',
          entityId: user.id,
          metadata: { provider: 'google', initialRole: user.role, status: 'ACTIVE' },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });
      } else {
        // Prevent reactivation of suspended accounts
        if (user.status === 'SUSPENDED' || !user.isActive) {
          await this.auditService.logEvent({
            userId: user.id,
            action: AuditAction.LOGIN_FAILURE,
            entityType: 'User',
            entityId: user.id,
            metadata: { reason: 'ACCOUNT_SUSPENDED_OR_INACTIVE', email: user.email },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          });
          throw new UnauthorizedException('Account has been suspended or deactivated');
        }

        // Update login timestamp and photo if updated
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

      // Generate server session token (cryptographically strong 256-bit random hex)
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
        action: AuditAction.LOGIN_SUCCESS,
        entityType: 'Session',
        metadata: { provider: 'google', isNewUser, role: user.role },
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
          status: user.status || 'ACTIVE',
          createdAt: user.createdAt.toISOString(),
          lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        },
      };

      return session;
    } catch (error: any) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Database failure during user authentication for ${email}: ${error?.message}`,
        error?.stack,
      );
      await this.auditService.logEvent({
        action: AuditAction.LOGIN_FAILURE,
        entityType: 'Database',
        metadata: { reason: 'DATABASE_ERROR' },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new InternalServerErrorException(
        'Authentication service encountered a database error. Please try again later.',
      );
    }
  }

  /**
   * Validates a session token and returns the authenticated safe user profile.
   * Strictly validates against PostgreSQL session table.
   */
  async validateSession(sessionToken: string): Promise<AuthSession | null> {
    if (!sessionToken) return null;

    try {
      const dbSession = await this.prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });

      if (
        !dbSession ||
        dbSession.expires < new Date() ||
        !dbSession.user.isActive ||
        dbSession.user.status === 'SUSPENDED'
      ) {
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
          status: dbSession.user.status || 'ACTIVE',
          createdAt: dbSession.user.createdAt.toISOString(),
          lastLoginAt: dbSession.user.lastLoginAt ? dbSession.user.lastLoginAt.toISOString() : null,
        },
      };
    } catch (error: any) {
      this.logger.error(`Database failure during session validation: ${error?.message}`);
      return null;
    }
  }

  /**
   * Destroys an active session in the database
   */
  async logout(sessionToken: string, userId?: string): Promise<void> {
    try {
      await this.prisma.session.deleteMany({
        where: { sessionToken },
      });
    } catch (error: any) {
      this.logger.error(`Database failure during session logout: ${error?.message}`);
    }

    await this.auditService.logEvent({
      userId: userId || null,
      action: AuditAction.LOGOUT,
      entityType: 'Session',
    });
  }
}
