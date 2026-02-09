import { db } from '@template/db/client';
import type { CheckConstraint } from './types';

export const addCheckConstraint = async ({ table, field, condition = '>= 0' }: CheckConstraint) => {
  const name = `${table}_${field}_check`;

  await db.$executeRawUnsafe(`
    DO $$ BEGIN
      IF EXISTS (SELECT FROM pg_constraint WHERE conname = '${name}' AND conrelid = '"${table}"'::regclass) THEN
        ALTER TABLE "${table}" DROP CONSTRAINT "${name}";
      END IF;
    END $$;
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK ("${field}" ${condition});
  `);
};
