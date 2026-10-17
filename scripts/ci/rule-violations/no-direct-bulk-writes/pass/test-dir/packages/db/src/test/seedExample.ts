import { db } from '@template/db';

// Test helper under packages/db/src/test/** (not *.test.ts) — exempt: it may exercise the
// raw bulk op to assert the guard throws.
export const expectBulkWriteRejected = async () => {
  await db.contact.createMany({ data: [] });
};
