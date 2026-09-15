import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '@shared/constants/roles';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access if no roles are defined on the route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const context = createMockContext(null);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException if unauthenticated user attempts to access role-protected route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createMockContext(null);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException if user has USER role but route requires ADMIN', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createMockContext({ id: 'u1', role: Role.USER });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow access if user has ADMIN role and route requires ADMIN', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createMockContext({ id: 'u2', role: Role.ADMIN });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if user has GUARDIAN role and route requires [GUARDIAN, ADMIN]', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.GUARDIAN, Role.ADMIN]);
    const context = createMockContext({ id: 'u3', role: Role.GUARDIAN });

    expect(guard.canActivate(context)).toBe(true);
  });
});
