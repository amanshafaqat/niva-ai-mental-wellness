import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Check HttpOnly cookie first, then fallback to Authorization header
    let token: string | undefined = request.cookies?.niva_session;

    if (!token) {
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '').trim();
      }
    }

    if (!token) {
      throw new UnauthorizedException('Authentication session required');
    }

    const session = await this.authService.validateSession(token);

    if (!session) {
      throw new UnauthorizedException('Session is invalid or has expired');
    }

    // Attach authenticated user to request for downstream handlers and RBAC RolesGuard
    request.user = session.user;
    request.sessionToken = token;

    return true;
  }
}
