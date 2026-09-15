import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { Roles } from '../authorization/roles.decorator';
import { RolesGuard } from '../authorization/roles.guard';
import { Role } from '@shared/constants/roles';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Protected administrative audit log query endpoint
   * Strictly requires ADMIN role (enforced via RolesGuard)
   */
  @Get('logs')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  async getLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    return this.auditService.getRecentLogs(parsedLimit, parsedOffset);
  }
}
