import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

@Module({
  providers: [RolesGuard, Reflector],
  exports: [RolesGuard],
})
export class AuthorizationModule {}
