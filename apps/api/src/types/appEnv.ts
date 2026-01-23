import type { ExtendedPrismaClient, Prisma } from '@template/db';

// Context variables available in all request handlers
export type AppVars = {
  // Database
  db: ExtendedPrismaClient;
  txn: Prisma.TransactionClient | undefined;

  // Current user (set by auth middleware)
  user: {
    id: string;
    email: string;
  } | null;

  // Request metadata
  requestId: string;
};

// Extract keys for type-safe context access
export type AppVarKeys = Extract<keyof AppVars, string>;

// Hono environment type
export type AppEnv = {
  Variables: AppVars;
};
