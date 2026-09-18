import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;
let isPrismaConnected: boolean | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prisma;
}

export async function isDatabaseConnected(): Promise<boolean> {
  if (isPrismaConnected !== null) return isPrismaConnected;
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    isPrismaConnected = true;
    return true;
  } catch {
    isPrismaConnected = false;
    return false;
  }
}
