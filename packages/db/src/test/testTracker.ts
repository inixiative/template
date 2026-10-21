/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import type { Db } from '@template/db/clientTypes';
import { DbAction, HookTiming, registerDbHook } from '@template/db/extensions/hookRegistry';
import { isModelName } from '@template/db/utils/modelNames';

const touchedTables = new Set<string>();

// Registered once by packages/db/src/client.ts; a test never calls it (check-test-tracker-registration).
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

  // Mock-model tests register names that have no table.
  const tables = Array.from(touchedTables).filter(isModelName);
  if (!tables.length) {
    touchedTables.clear();
    return;
  }

  // One transaction: SET LOCAL pins the FK bypass to this connection and ends with it. Every write is
  // tracked (nested writes are refused), so DELETE needs no CASCADE, and it is far cheaper than TRUNCATE.
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
    await tx.$executeRawUnsafe(tables.map((table) => `DELETE FROM "${table}"`).join('; '));
  });
  // Forget the tables only once the delete commits, so a rolled-back cleanup is retried next time.
  touchedTables.clear();
};

export const resetTouchedTables = () => {
  touchedTables.clear();
};
