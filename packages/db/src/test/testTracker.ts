/**
 * @atlas
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { Db } from '@template/db/clientTypes';
import { DbAction, HookTiming, registerDbHook } from '@template/db/extensions/mutationLifeCycle';

const touchedTables = new Set<string>();

export const registerTestTracker = () => {
  if (process.env.NODE_ENV !== 'test' && process.env.ENVIRONMENT !== 'test') return;

  const allMutations = [
    DbAction.create,
    DbAction.createManyAndReturn,
    DbAction.update,
    DbAction.updateManyAndReturn,
    DbAction.upsert,
    DbAction.delete,
    DbAction.deleteMany,
  ];

  registerDbHook('testTracker', '*', HookTiming.before, allMutations, async ({ model }) => {
    touchedTables.add(model as string);
  });
};

export const getTouchedTables = (): ReadonlySet<string> => touchedTables;

export const cleanupTouchedTables = async (db: Db) => {
  if (process.env.NODE_ENV !== 'test' && process.env.ENVIRONMENT !== 'test') return;
  if (touchedTables.size === 0) return;

  const tables = Array.from(touchedTables);

  // Disable FK constraints, truncate, then re-enable
  // session_replication_role = 'replica' disables all triggers including FK checks
  await db.$executeRawUnsafe(`SET session_replication_role = 'replica'`);

  try {
    for (const table of tables) {
      // Use CASCADE to handle any remaining FK relationships
      // Wrap in try-catch to handle non-existent tables (e.g., from mock model tests)
      try {
        await db.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
      } catch {
        // Table doesn't exist - likely a test model like 'NonExistentModel'
      }
    }
  } finally {
    await db.$executeRawUnsafe(`SET session_replication_role = 'origin'`);
    touchedTables.clear();
  }
};

export const resetTouchedTables = () => {
  touchedTables.clear();
};
