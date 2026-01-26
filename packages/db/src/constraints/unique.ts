import { db } from '@template/db/client';
import type { UniqueWhereNotNull } from './types';

export async function addUniqueWhereNotNull({ table, fields }: UniqueWhereNotNull) {
  const name = `${table}_${fields.join('_')}_unique_nn`;
  const fieldList = fields.map((f) => `"${f}"`).join(', ');
  const whereClause = fields.map((f) => `"${f}" IS NOT NULL`).join(' AND ');

  await db.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = '${name}') THEN
        CREATE UNIQUE INDEX "${name}" ON "${table}" (${fieldList}) WHERE ${whereClause};
      END IF;
    END $$;
  `);
}
