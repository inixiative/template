import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { cleanupTouchedTables, createUser } from '@template/db/test';
import { uuidv7 } from 'uuidv7';
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

    await db.session.create({
      data: { userId: user.id, token: uuidv7(), expiresAt: new Date(Date.now() + 86_400_000) },
    });

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.lastLoginAt).not.toBeNull();
  });
});
