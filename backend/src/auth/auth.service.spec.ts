import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '@shared/constants/roles';
import { InternalServerErrorException } from '@nestjs/common';

describe('AuthService (Phase 2.1 Security Hardened)', () => {
  let authService: AuthService;
  let prismaService: PrismaService;
  let auditService: AuditService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    account: {
      upsert: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockAudit = {
    logEvent: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('OAuth State Validation (CSRF Protection)', () => {
    it('should validate correctly when state matches cookie exactly', () => {
      const state = 'a6b9c8d7e6f50123456789abcdef0123';
      const cookie = 'a6b9c8d7e6f50123456789abcdef0123';
      const result = authService.validateOAuthState(state, cookie);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject when incoming state is missing or empty', () => {
      const result = authService.validateOAuthState('', 'cookie-state-value');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('MISSING_OAUTH_STATE');
    });

    it('should reject when expected cookie state is missing', () => {
      const result = authService.validateOAuthState('incoming-state-value', undefined);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('MISSING_EXPECTED_STATE_COOKIE');
    });

    it('should reject when state parameter does not match cookie', () => {
      const result = authService.validateOAuthState(
        'state_attacker_payload',
        'state_legitimate_cookie',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('STATE_MISMATCH');
    });

    it('should reject mismatched lengths without throwing timing exceptions', () => {
      const result = authService.validateOAuthState('short', 'much_longer_state_string');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('STATE_MISMATCH');
    });
  });

  describe('Database Failure Handling (No Fake User Fallback)', () => {
    it('should throw InternalServerErrorException when database is unavailable', async () => {
      const googlePayload = {
        sub: 'google-sub-error-test',
        email: 'patient@hospital.org',
        email_verified: true,
        name: 'Jordan Rivera',
        picture: 'https://avatar.url/jordan.png',
      };

      // Force database error
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Connection to PostgreSQL failed'));

      await expect(authService.handleGoogleUser(googlePayload)).rejects.toThrow(
        InternalServerErrorException,
      );

      // Verify audit event was logged for database error
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILURE',
          entityType: 'Database',
          metadata: { reason: 'DATABASE_ERROR' },
        }),
      );
    });

    it('should not authenticate or return fake user if user table query fails', async () => {
      mockPrisma.session.findUnique.mockRejectedValue(new Error('Database timeout'));
      const session = await authService.validateSession('niva_sess_invalid');
      expect(session).toBeNull();
    });
  });

  describe('Default Role Assignment & Admin Bootstrap', () => {
    it('should default normal new users to Role.USER', async () => {
      const now = new Date();
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'usr_new_1',
        email: 'alex@example.com',
        name: 'Alex Johnson',
        avatarUrl: 'https://avatar.url/alex.png',
        role: Role.USER,
        status: 'ACTIVE',
        isActive: true,
        createdAt: now,
        lastLoginAt: now,
      });
      mockPrisma.account.upsert.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({
        sessionToken: 'niva_sess_abc123',
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const session = await authService.handleGoogleUser({
        sub: 'google-123',
        email: 'alex@example.com',
        email_verified: true,
        name: 'Alex Johnson',
      });

      expect(session.user.role).toBe(Role.USER);
      expect(session.token).toMatch(/^niva_sess_/);
    });
  });

  describe('Session Invalidation', () => {
    it('should delete session in database on logout', async () => {
      const sessionToken = 'niva_sess_test_token';
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await expect(authService.logout(sessionToken, 'user-1')).resolves.not.toThrow();
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { sessionToken },
      });
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGOUT',
          entityType: 'Session',
        }),
      );
    });
  });
});
