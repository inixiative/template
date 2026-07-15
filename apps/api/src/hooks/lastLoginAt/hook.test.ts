import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { cleanupTouchedTables, createSession, createUser } from '@template/db/test';
import { registerLastLoginAtHook } from '#/hooks/lastLoginAt/hook';

describe('lastLoginAt hook', () => {
  beforeAll(() => registerLastLoginAtHook());
  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('stamps User.lastLoginAt when a Session is created', async () => {
    const { entity: user } = await createUser();
    expect(user.lastLoginAt).toBeNull();

    await createSession({}, { user });

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.lastLoginAt).not.toBeNull();
  });
});
