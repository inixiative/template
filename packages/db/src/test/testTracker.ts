/**
 * @atlas
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { Db } from '@template/db/clientTypes';
import { DbAction, HookTiming, registerDbHook } from '@template/db/extensions/hookRegistry';

const touchedTables = new Set<string>();
let existingTables: Promise<Set<string>> | undefined;

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
    existingTables ??= db
      .$queryRawUnsafe<{ tablename: string }[]>(
        `SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`,
      )
      .then((rows) => new Set(rows.map((row) => row.tablename)));
    const known = await existingTables;
    const truncatable = tables.filter((table) => known.has(table));
    if (truncatable.length > 0)
      await db.$executeRawUnsafe(
        `TRUNCATE TABLE ${truncatable.map((table) => `"${table}"`).join(', ')} CASCADE`,
      );
  } finally {
    await db.$executeRawUnsafe(`SET session_replication_role = 'origin'`);
    touchedTables.clear();
  }
};

export const resetTouchedTables = () => {
  touchedTables.clear();
};
