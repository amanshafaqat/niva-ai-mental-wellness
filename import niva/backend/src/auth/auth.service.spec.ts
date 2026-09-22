import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '@shared/constants/roles';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: PrismaService;
  let auditService: AuditService;

  beforeEach(async () => {
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

  it('should default a new Google OAuth user to Role.USER', async () => {
    const googlePayload = {
      sub: 'google-sub-123',
      email: 'alex@example.com',
      email_verified: true,
      name: 'Alex Johnson',
      picture: 'https://avatar.url/alex.png',
    };

    const session = await authService.handleGoogleUser(googlePayload);
    expect(session.user.email).toBe('alex@example.com');
    expect(session.user.role).toBe(Role.USER);
    expect(session.token).toMatch(/^niva_sess_/);
  });

  it('should invalidate sessions on logout', async () => {
    const sessionToken = 'niva_sess_test_token';
    await expect(authService.logout(sessionToken, 'user-1')).resolves.not.toThrow();
  });
});
