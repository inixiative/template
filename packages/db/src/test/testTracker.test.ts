import { afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { createSpaceUser } from '@template/db/test';
import { cleanupTouchedTables, getTouchedTables } from '@template/db/test/testTracker';

describe('cleanupTouchedTables', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('empties every touched table, parents and children alike', async () => {
    await createSpaceUser();
    expect(getTouchedTables().has('SpaceUser')).toBe(true);

    await cleanupTouchedTables(db);

    expect(getTouchedTables().size).toBe(0);
    expect(await db.user.count()).toBe(0);
    expect(await db.space.count()).toBe(0);
    expect(await db.spaceUser.count()).toBe(0);
  });

  it('leaves foreign keys enforced on every pooled connection', async () => {
    await createSpaceUser();
    await cleanupTouchedTables(db);

    const roles = await Promise.all(
      Array.from({ length: 20 }, () =>
        db.$queryRawUnsafe<{ session_replication_role: string }[]>('SHOW session_replication_role'),
      ),
    );
    expect(roles.flat().map((row) => row.session_replication_role)).toEqual(
      Array(20).fill('origin'),
    );
  });

  it('skips names that are not models', async () => {
    await createSpaceUser();
    (getTouchedTables() as Set<string>).add('NonExistentModel');

    await cleanupTouchedTables(db);

    expect(await db.spaceUser.count()).toBe(0);
  });
});
