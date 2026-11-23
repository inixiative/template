/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { afterAll, beforeAll } from 'bun:test';
import { db } from '@template/db/client';
import { rowsKeptUntilEndOfFile } from '@template/db/test/rowsKeptUntilEndOfFile';
import { cleanupTouchedTables } from '@template/db/test/testTracker';

export const keepRowsUntilEndOfFile = () => {
  beforeAll(() => {
    rowsKeptUntilEndOfFile.on = true;
  });
  afterAll(async () => {
    rowsKeptUntilEndOfFile.on = false;
    await cleanupTouchedTables(db);
  });
};
