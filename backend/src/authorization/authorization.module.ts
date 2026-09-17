import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserGuard } from './guards/user.guard';
import { GuardianGuard } from './guards/guardian.guard';
import { AdminGuard } from './guards/admin.guard';

@Module({
  providers: [RolesGuard, UserGuard, GuardianGuard, AdminGuard, Reflector],
  exports: [RolesGuard, UserGuard, GuardianGuard, AdminGuard],
})
export class AuthorizationModule {}
