import { afterAll, afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { createUser } from '@template/db/test';
import { keepRowsUntilEndOfFile } from '@template/db/test/keepRowsUntilEndOfFile';
import { cleanupTouchedTables } from '@template/db/test/testTracker';

const written: string[] = [];
const writtenRowsLeft = () => db.user.count({ where: { id: { in: written } } });

keepRowsUntilEndOfFile();

afterAll(async () => {
  expect(await writtenRowsLeft()).toBe(0);
});

describe('keepRowsUntilEndOfFile', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  afterAll(async () => {
    expect(await writtenRowsLeft()).toBe(2);
  });

  it('keeps a row past the cleanup after the test that wrote it', async () => {
    const { entity: user } = await createUser();
    written.push(user.id);
    await cleanupTouchedTables(db);

    expect(await db.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it('keeps every test’s rows until the file ends', async () => {
    const { entity: user } = await createUser();
    written.push(user.id);
  });
});
