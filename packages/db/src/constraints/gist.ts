import { db } from '@template/db/client';

export async function addGistIndex(table: string, column: string) {
  const name = `${table}_${column}_gist`;

  await db.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = '${name}') THEN
        CREATE INDEX "${name}" ON "${table}" USING GIST ("${column}");
      END IF;
    END $$;
  `);
}
