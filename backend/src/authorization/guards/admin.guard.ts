import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Role } from '@shared/constants/roles';

/**
 * AdminGuard
 * Strictly restricts access to users with ADMIN role.
 * Standard USER and GUARDIAN roles are rejected with 403 Forbidden.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('AdminGuard: Unauthenticated request rejected');
      throw new UnauthorizedException('Authentication required');
    }

    if (user.role !== Role.ADMIN) {
      this.logger.warn(
        `AdminGuard: RBAC rejection for user ${user.id || user.email} with role ${user.role}`,
      );
      throw new ForbiddenException(
        `Access denied. Resource strictly requires ADMIN role. Current role: ${user.role}`,
      );
    }

    return true;
  }
}
