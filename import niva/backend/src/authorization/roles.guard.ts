import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@shared/constants/roles';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles specified on handler or controller, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn(`Access rejected: Unauthenticated request to protected route`);
      throw new UnauthorizedException('Authentication required to access this resource');
    }

    const userRole: Role = user.role;

    // Direct check: Does the user role match any required role?
    const hasRole = requiredRoles.includes(userRole);

    if (!hasRole) {
      this.logger.warn(
        `RBAC Violation: User ${user.id || user.email} with role ${userRole} attempted to access route requiring [${requiredRoles.join(', ')}]`,
      );
      throw new ForbiddenException(
        `Access denied. Your role (${userRole}) is not authorized for this operation.`,
      );
    }

    return true;
  }
}
