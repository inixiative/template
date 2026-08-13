import '#/config/env';
import { db } from '@template/db';
import { registerTransactionContextProviders } from '#/lib/transactionContext';

// Mirrors the api and worker entrypoints: tests register hooks individually, so the providers have
// to be wired here or hook frames run without the caller's audit actor.
registerTransactionContextProviders();

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
