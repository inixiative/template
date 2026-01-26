import { DbAction, HookTiming, registerDbHook } from '@template/db/extensions/mutationLifeCycle';
import type { ExtendedPrismaClient } from '@template/db/client';

const touchedTables = new Set<string>();

/**
 * Register test tracker hook to track all mutated tables.
 * Only registers if NODE_ENV === 'test' or ENVIRONMENT === 'test'.
 *
 * Call this once at test setup (e.g., in a global setup file or createTestApp).
 */
export const registerTestTracker = () => {
  if (process.env.NODE_ENV !== 'test' && process.env.ENVIRONMENT !== 'test') return;

  const allMutations = [
    DbAction.create,
    DbAction.createMany,
    DbAction.update,
    DbAction.updateMany,
    DbAction.upsert,
    DbAction.delete,
    DbAction.deleteMany,
  ];

  registerDbHook('testTracker', '*', HookTiming.before, allMutations, async ({ model }) => {
    touchedTables.add(model as string);
  });
};

/**
 * Get the set of tables that were touched during tests.
 * Useful for debugging which tables need cleanup.
 */
export const getTouchedTables = (): ReadonlySet<string> => touchedTables;

/**
 * Cleanup all tables that were touched during tests.
 * Only runs if NODE_ENV === 'test' or ENVIRONMENT === 'test'.
 *
 * Uses PostgreSQL TRUNCATE with CASCADE for efficient cleanup.
 * Temporarily disables foreign key constraints via session_replication_role.
 *
 * @param db - The Prisma client instance
 *
 * @example
 * ```typescript
 * afterEach(async () => {
 *   await cleanupTouchedTables(db);
 * });
 * ```
 */
export const cleanupTouchedTables = async (db: ExtendedPrismaClient) => {
  if (process.env.NODE_ENV !== 'test' && process.env.ENVIRONMENT !== 'test') return;
  if (touchedTables.size === 0) return;

  const tables = Array.from(touchedTables);

  // Disable FK constraints, truncate, then re-enable
  // session_replication_role = 'replica' disables all triggers including FK checks
  await db.$executeRawUnsafe(`SET session_replication_role = 'replica'`);

  try {
    for (const table of tables) {
      // Use CASCADE to handle any remaining FK relationships
      await db.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
    }
  } finally {
    await db.$executeRawUnsafe(`SET session_replication_role = 'origin'`);
    touchedTables.clear();
  }
};

/**
 * Reset the touched tables set without truncating.
 * Useful if you want to track tables fresh for a specific test.
 */
export const resetTouchedTables = () => {
  touchedTables.clear();
};
