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
 * GuardianGuard
 * Restricts access to users with GUARDIAN or ADMIN roles.
 * Standard USER roles are rejected with 403 Forbidden.
 */
@Injectable()
export class GuardianGuard implements CanActivate {
  private readonly logger = new Logger(GuardianGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('GuardianGuard: Unauthenticated request rejected');
      throw new UnauthorizedException('Authentication required');
    }

    if (user.role !== Role.GUARDIAN && user.role !== Role.ADMIN) {
      this.logger.warn(
        `GuardianGuard: RBAC rejection for user ${user.id || user.email} with role ${user.role}`,
      );
      throw new ForbiddenException(
        `Access denied. Resource requires GUARDIAN or ADMIN authorization. Active role: ${user.role}`,
      );
    }

    return true;
  }
}
