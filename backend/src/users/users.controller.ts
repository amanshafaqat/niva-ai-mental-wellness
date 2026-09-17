import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuditService } from '../audit/audit.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../authorization/roles.guard';
import { Roles } from '../authorization/roles.decorator';
import { Role } from '@shared/constants/roles';
import { AuditAction } from '@shared/types/audit';

@Controller('users')
@UseGuards(SessionAuthGuard, RolesGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Returns current user's profile and RBAC permissions
   */
  @Get('me')
  async getProfile(@Req() req: any) {
    return this.usersService.findById(req.user.id);
  }

  /**
   * Security Boundary: User role self-modification prevention
   * A normal user must NEVER be able to choose ADMIN, choose GUARDIAN,
   * modify their own role, or send a request that changes their role.
   */
  @Patch('me/role')
  async attemptRoleChange(@Req() req: any, @Body() body: any) {
    this.logger.warn(
      `Role tampering prevented: User ${req.user.id} (${req.user.role}) attempted to set role to '${body?.role}'`,
    );

    await this.auditService.logEvent({
      userId: req.user.id,
      action: AuditAction.ROLE_CHANGE_REJECTED,
      entityType: 'User',
      entityId: req.user.id,
      metadata: {
        attemptedRole: body?.role,
        currentRole: req.user.role,
        violation: 'UNAUTHORIZED_ROLE_MODIFICATION_ATTEMPT',
      },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    throw new ForbiddenException(
      'Role self-modification is strictly forbidden. User roles are governed exclusively by server-side policy.',
    );
  }

  /**
   * Protected route demonstrating GUARDIAN role authorization
   * Allows GUARDIAN or ADMIN roles
   */
  @Get('guardian/summary')
  @Roles(Role.GUARDIAN, Role.ADMIN)
  async getGuardianSummary(@Req() req: any) {
    return {
      message: 'Access granted: Guardian oversight endpoint.',
      guardianId: req.user.id,
      consentedWardsCount: 0,
      safetyStatus: 'all_normal',
      notice: 'Consent architecture active. Direct conversation access is strictly prohibited.',
    };
  }

  /**
   * Protected administrative route demonstrating ADMIN role authorization
   */
  @Get('admin/directory')
  @Roles(Role.ADMIN)
  async getAdminDirectory() {
    const users = await this.usersService.getAllUsersForAdmin();
    return {
      total: users.length,
      users,
    };
  }
}
