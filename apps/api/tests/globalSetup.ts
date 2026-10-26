import '#/config/env';
import { afterEach } from 'bun:test';
import { db } from '@template/db';
import { resetEnvOverrides } from '@template/shared/utils';
import { SQL } from 'bun';

// Global backstop: clear any env overrides a test registered (setEnvOverride / withEnv)
// so nothing leaks into the next file in the single-process worker.
afterEach(resetEnvOverrides);

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
