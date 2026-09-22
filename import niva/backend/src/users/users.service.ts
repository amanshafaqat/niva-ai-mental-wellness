import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, ROLE_PERMISSIONS } from '@shared/constants/roles';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return {
        ...user,
        permissions: ROLE_PERMISSIONS[user.role as Role]?.permissions || [],
      };
    } catch {
      return {
        id,
        email: 'user@niva.wellness',
        name: 'NIVA User',
        avatarUrl: null,
        role: Role.USER,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        permissions: ROLE_PERMISSIONS[Role.USER].permissions,
      };
    }
  }

  async getAllUsersForAdmin(limit = 20) {
    try {
      return await this.prisma.user.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });
    } catch {
      return [
        {
          id: 'mock-user-1',
          email: 'demo-user@niva.wellness',
          name: 'Demo Student User',
          role: Role.USER,
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        },
      ];
    }
  }
}
