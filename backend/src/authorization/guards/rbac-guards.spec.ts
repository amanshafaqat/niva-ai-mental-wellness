import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserGuard } from './user.guard';
import { GuardianGuard } from './guardian.guard';
import { AdminGuard } from './admin.guard';
import { Role } from '@shared/constants/roles';

describe('Phase 2 RBAC Guards', () => {
  const createMockContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  describe('UserGuard', () => {
    const guard = new UserGuard();

    it('should throw UnauthorizedException if no user in context', () => {
      expect(() => guard.canActivate(createMockContext(null))).toThrow(UnauthorizedException);
    });

    it('should allow active user with USER role', () => {
      expect(guard.canActivate(createMockContext({ id: 'u1', role: Role.USER }))).toBe(true);
    });

    it('should allow active user with ADMIN role', () => {
      expect(guard.canActivate(createMockContext({ id: 'u2', role: Role.ADMIN }))).toBe(true);
    });
  });

  describe('GuardianGuard', () => {
    const guard = new GuardianGuard();

    it('should throw UnauthorizedException if no user in context', () => {
      expect(() => guard.canActivate(createMockContext(null))).toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if user has USER role', () => {
      expect(() => guard.canActivate(createMockContext({ id: 'u1', role: Role.USER }))).toThrow(ForbiddenException);
    });

    it('should allow user with GUARDIAN role', () => {
      expect(guard.canActivate(createMockContext({ id: 'g1', role: Role.GUARDIAN }))).toBe(true);
    });

    it('should allow user with ADMIN role', () => {
      expect(guard.canActivate(createMockContext({ id: 'a1', role: Role.ADMIN }))).toBe(true);
    });
  });

  describe('AdminGuard', () => {
    const guard = new AdminGuard();

    it('should throw UnauthorizedException if no user in context', () => {
      expect(() => guard.canActivate(createMockContext(null))).toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if user has USER role', () => {
      expect(() => guard.canActivate(createMockContext({ id: 'u1', role: Role.USER }))).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user has GUARDIAN role', () => {
      expect(() => guard.canActivate(createMockContext({ id: 'g1', role: Role.GUARDIAN }))).toThrow(ForbiddenException);
    });

    it('should allow user with ADMIN role', () => {
      expect(guard.canActivate(createMockContext({ id: 'a1', role: Role.ADMIN }))).toBe(true);
    });
  });
});
