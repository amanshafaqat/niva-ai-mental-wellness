/**
 * NIVA Database Seeder - Phase 1 Foundation
 * Populates essential system roles and a designated admin record via environment variables.
 * Note: Passwords are NEVER stored. Identity is strictly verified through Google OAuth.
 */

import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting NIVA Phase 1 Database Seed...');

  const systemAdminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@niva.internal';

  // Upsert initial platform admin account (controlled strictly through server-side configuration)
  const adminUser = await prisma.user.upsert({
    where: { email: systemAdminEmail },
    update: { role: Role.ADMIN },
    create: {
      email: systemAdminEmail,
      name: 'NIVA Platform Administrator',
      role: Role.ADMIN,
      isActive: true,
      emailVerified: new Date(),
    },
  });

  console.log(`✅ Platform administrator established: ${adminUser.email} (Role: ${adminUser.role})`);

  // Log audit event for seed
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'SYSTEM_DATABASE_SEEDED',
      entityType: 'System',
      entityId: adminUser.id,
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0-phase1',
      },
    },
  });

  console.log('✅ Seed audit log recorded.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
