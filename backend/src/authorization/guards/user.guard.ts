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
 * UserGuard
 * Ensures the request is authenticated and the user account is active.
 * Permits USER, GUARDIAN, and ADMIN roles.
 */
@Injectable()
export class UserGuard implements CanActivate {
  private readonly logger = new Logger(UserGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('UserGuard: Unauthenticated request rejected');
      throw new UnauthorizedException('Authentication required to access this resource');
    }

    if (user.isActive === false || user.status === 'SUSPENDED') {
      this.logger.warn(`UserGuard: Inactive or suspended user ${user.id} rejected`);
      throw new ForbiddenException('Account is inactive or suspended');
    }

    const validRoles = [Role.USER, Role.GUARDIAN, Role.ADMIN];
    if (!validRoles.includes(user.role)) {
      throw new ForbiddenException('Invalid user role');
    }

    return true;
  }
}
