import { afterAll, afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { createUser } from '@template/db/test';
import { keepRowsUntilEndOfFile } from '@template/db/test/keepRowsUntilEndOfFile';
import { cleanupTouchedTables, touchedTableNames } from '@template/db/test/testTracker';

afterAll(async () => {
  expect(await db.user.count()).toBe(2);
});

keepRowsUntilEndOfFile();

afterAll(async () => {
  expect(await db.user.count()).toBe(0);
  expect(touchedTableNames().size).toBe(0);
});

describe('keepRowsUntilEndOfFile', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('keeps a row past the cleanup after the test that wrote it', async () => {
    const { entity: user } = await createUser();
    await cleanupTouchedTables(db);

    expect(await db.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it('keeps every test’s rows until the file ends', async () => {
    await createUser();
  });
});
