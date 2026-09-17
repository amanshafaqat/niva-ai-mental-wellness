import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, ROLE_PERMISSIONS } from '@shared/constants/roles';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

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
          status: true,
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
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to retrieve user ID ${id}: ${error?.message}`);
      throw new InternalServerErrorException(
        'Unable to retrieve user information due to an internal server error',
      );
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
          status: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to retrieve user directory: ${error?.message}`);
      throw new InternalServerErrorException(
        'Unable to retrieve user directory due to an internal server error',
      );
    }
  }
}
