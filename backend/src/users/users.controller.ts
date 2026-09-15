import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../authorization/roles.guard';
import { Roles } from '../authorization/roles.decorator';
import { Role } from '@shared/constants/roles';

@Controller('users')
@UseGuards(SessionAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Returns current user's profile and RBAC permissions
   */
  @Get('me')
  async getProfile(@Req() req: any) {
    return this.usersService.findById(req.user.id);
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
