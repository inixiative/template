import '#/config/env';
import { afterEach, beforeEach } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { cleanupTouchedTables } from '@template/db/test';
import { resetEnvOverrides } from '@template/shared/utils';
import { SQL } from 'bun';
import { registerHooks } from '#/hooks';

// Global backstop: clear any env overrides a test registered (setEnvOverride / withEnv)
// so nothing leaks into the next file in the single-process worker.
afterEach(resetEnvOverrides);

// Production's hooks, restored on both sides of a test so one a test adds or lifts never reaches the next.
const restoreProductionHooks = () => {
  clearHookRegistry();
  registerHooks();
};
restoreProductionHooks();
beforeEach(restoreProductionHooks);

// Rows too: a test that reaches the database through a fixture has no cleanup of its own to forget.
afterEach(async () => {
  await cleanupTouchedTables(db);
  restoreProductionHooks();
});

const isTestDatabase = process.env.NODE_ENV === 'test' || process.env.ENVIRONMENT === 'test';

const ONE_TEST_RUN_PER_DATABASE = 219_013;

const holdTestDatabase = async () => {
  const connection = await new SQL().reserve();
  const [{ held, database }] = await connection<{ held: boolean; database: string }[]>`
    SELECT pg_try_advisory_lock(${ONE_TEST_RUN_PER_DATABASE}) AS held, current_database() AS database
  `;
  if (!held) throw new Error(`another test run is using ${database}`);
  return connection;
};

const truncateAll = async () => {
  if (!isTestDatabase) return;

  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE '_prisma%'
  `;

  if (tables.length === 0) return;

  await db.$executeRawUnsafe(`SET session_replication_role = 'replica'`);
  try {
    for (const { tablename } of tables) {
      await db.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
    }
  } finally {
    await db.$executeRawUnsafe(`SET session_replication_role = 'origin'`);
  }
};

const _testDatabaseHold = isTestDatabase ? await holdTestDatabase() : null;
await truncateAll();
