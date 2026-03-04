import { db } from '@template/db';

/**
 * Runs before each test file worker.
 * Truncates all public tables to clean up any state left by a crashed previous run.
 * In normal flow (afterAll cleanup working) this is a near-instant no-op on empty tables.
 */
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
