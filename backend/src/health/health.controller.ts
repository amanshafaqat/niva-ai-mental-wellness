import { Controller, Get } from '@nestjs/common';
import { HealthService, HealthCheckResult } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(): Promise<HealthCheckResult> {
    return this.healthService.check();
  }
}
