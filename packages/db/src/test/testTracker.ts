/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Db } from '@template/db/clientTypes';
import { DbAction, HookTiming, registerDbHook } from '@template/db/extensions/hookRegistry';
import { isModelName, modelNames } from '@template/db/utils/modelNames';

const touchedTables = new Set<string>();

let startupClear: Promise<void> | undefined;

// One transaction: SET LOCAL pins the FK bypass to this connection and ends with it. Every write is
// tracked (nested writes are refused), so DELETE needs no CASCADE, and it is far cheaper than TRUNCATE.
const deleteFrom = async (db: Db, tables: readonly string[]) => {
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
    await tx.$executeRawUnsafe(tables.map((table) => `DELETE FROM "${table}"`).join('; '));
  });
};

// Every test process starts on an empty database: before its first tracked write it deletes every
// model's rows, so no test depends on what an earlier or aborted run left. It waits for that first
// write, so a process that only loads the client never connects, and it runs in the context captured
// at registration, so a first write inside db.txn doesn't pull the clear into that transaction.
// TEST_DB_CLEARED is inherited by child processes a test spawns, which would otherwise delete the
// parent's rows; IS_E2E skips it for E2E processes that share one seeded database.
const clearDatabaseOnce = (outsideTxn: <R>(fn: () => R) => R) => {
  if (process.env.IS_E2E === '1' || process.env.TEST_DB_CLEARED === '1') return;
  startupClear ??= outsideTxn(async () => {
    const { db } = await import('@template/db/client');
    await deleteFrom(db, modelNames);
  }).then(() => {
    process.env.TEST_DB_CLEARED = '1';
  });
  return startupClear;
};

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

  const outsideTxn = AsyncLocalStorage.snapshot();
  registerDbHook('testTracker', '*', HookTiming.before, allMutations, async ({ model }) => {
    await clearDatabaseOnce(outsideTxn);
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

  await deleteFrom(db, tables);
  // Forget the tables only once the delete commits, so a rolled-back cleanup is retried next time.
  touchedTables.clear();
};

export const resetTouchedTables = () => {
  touchedTables.clear();
};
