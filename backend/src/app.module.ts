import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AiModule } from './ai/ai.module';
import { ConversationsModule } from './conversations/conversations.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthorizationModule,
    AuditModule,
    AuthModule,
    UsersModule,
    AiModule,
    ConversationsModule,
  ],
})
export class AppModule {}
