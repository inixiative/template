import { afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { createSpaceUser, createUser } from '@template/db/test';
import { cleanupTouchedTables, getTouchedTables } from '@template/db/test/testTracker';

const writeInChildProcess = (env: Record<string, string | undefined>) =>
  Bun.spawnSync(
    [
      'bun',
      '-e',
      "const { db } = await import('@template/db'); await db.user.deleteMany({ where: { id: 'none' } });",
    ],
    { cwd: `${import.meta.dir}/../..`, env, stdout: 'pipe', stderr: 'pipe' },
  );

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

describe('clearing the database once per process', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('clears every table before the first write of a process', async () => {
    const { entity: user } = await createUser();

    const run = writeInChildProcess({ ...process.env, TEST_DB_CLEARED: undefined });

    expect(run.exitCode).toBe(0);
    expect(await db.user.count({ where: { id: user.id } })).toBe(0);
  }, 30_000);

  it('leaves the parent test rows alone in a child process it spawns', async () => {
    const { entity: user } = await createUser();

    const run = writeInChildProcess(process.env);

    expect(run.exitCode).toBe(0);
    expect(await db.user.count({ where: { id: user.id } })).toBe(1);
  }, 30_000);

  it('skips the clear in an E2E process', async () => {
    const { entity: user } = await createUser();

    const run = writeInChildProcess({ ...process.env, TEST_DB_CLEARED: undefined, IS_E2E: '1' });

    expect(run.exitCode).toBe(0);
    expect(await db.user.count({ where: { id: user.id } })).toBe(1);
  }, 30_000);
});
