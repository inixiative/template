/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { afterAll, beforeAll } from 'bun:test';
import { db } from '@template/db/client';
import { cleanupTouchedTables, keepRowsForTheFile } from '@template/db/test/testTracker';

export const keepRowsUntilEndOfFile = () => {
  beforeAll(() => keepRowsForTheFile(true));
  afterAll(async () => {
    keepRowsForTheFile(false);
    await cleanupTouchedTables(db);
  });
};
