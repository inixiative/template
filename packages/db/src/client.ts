import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { mutationLifeCycleExtension } from './extensions/mutationLifeCycle';
import { PrismaClient } from './generated/client/client';

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

export interface CreatePrismaClientOptions {
  enableMutationLogger?: boolean;
  connectionString?: string;
}

export const createPrismaClient = (options?: CreatePrismaClientOptions) => {
  const { enableMutationLogger = false, connectionString } = options || {};

  // Create pg Pool - uses DATABASE_URL from environment if not provided
  const pool = new Pool({
    connectionString: connectionString || process.env.DATABASE_URL,
  });

  // Create Prisma adapter
  const adapter = new PrismaPg(pool);

  const prisma = new PrismaClient({
    adapter,
    log: ['error'],
  });

  const extendedPrisma = prisma.$extends(
    mutationLifeCycleExtension({
      enableLogging: enableMutationLogger,
    }),
  );

  return extendedPrisma;
};

// Singleton instance for general use
// Note: Only created when first accessed (lazy initialization)
let _db: ExtendedPrismaClient | null = null;

export const db = new Proxy({} as ExtendedPrismaClient, {
  get(_target, prop) {
    if (!_db) {
      _db = createPrismaClient();
    }
    return (_db as Record<string | symbol, unknown>)[prop];
  },
});
