import '#/config/env';
import { afterEach } from 'bun:test';
import { db } from '@template/db';
import { resetEnvOverrides } from '@template/shared/utils';

// Global backstop: clear any env overrides a test registered (setEnvOverride / withEnv)
// so nothing leaks into the next file in the single-process worker.
afterEach(resetEnvOverrides);

const truncateAll = async () => {
  if (process.env.NODE_ENV !== 'test' && process.env.ENVIRONMENT !== 'test') return;

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

await truncateAll();
