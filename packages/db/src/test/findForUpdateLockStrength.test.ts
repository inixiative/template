import { afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { createContact, createUser } from '@template/db/test/factories';
import { getNextSeq } from '@template/db/test/factory';
import { cleanupTouchedTables } from '@template/db/test/testTracker';

const HELD_MS = 300;

const settlesWithin = (promise: Promise<unknown>, ms: number) =>
  Promise.race([
    promise.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);

const holdingUser = async (userId: string, options?: { changesKey?: boolean }) => {
  const held = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  const holder = db.txn(async () => {
    await db.findForUpdate('User', { id: userId }, options);
    held.resolve();
    await release.promise;
  });
  await held.promise;
  return {
    release: async () => {
      release.resolve();
      await holder;
    },
  };
};

const contactOf = (userId: string) =>
  createContact({
    userId,
    ownerModel: 'User',
    type: 'email',
    value: { address: `lock-strength-${getNextSeq()}@test.com` },
  });

describe('db.findForUpdate lock strength', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('lets a row that references the locked row be inserted while the lock is held', async () => {
    const { entity: user } = await createUser();
    const lock = await holdingUser(user.id);
    try {
      expect(await settlesWithin(contactOf(user.id), HELD_MS * 5)).toBe(true);
    } finally {
      await lock.release();
    }
  });

  it('holds off such an insert until the lock is released when the transaction changes the key', async () => {
    const { entity: user } = await createUser();
    const lock = await holdingUser(user.id, { changesKey: true });
    const insert = contactOf(user.id);
    try {
      expect(await settlesWithin(insert, HELD_MS)).toBe(false);
    } finally {
      await lock.release();
    }
    expect(await settlesWithin(insert, HELD_MS * 5)).toBe(true);
  });

  for (const changesKey of [false, true]) {
    it(`makes a second locker and an update wait (changesKey: ${changesKey})`, async () => {
      const { entity: user } = await createUser();
      const lock = await holdingUser(user.id, { changesKey });
      const locker = db.txn(() => db.findForUpdate('User', { id: user.id }));
      const update = db.user.update({ where: { id: user.id }, data: { name: 'Waited' } });
      try {
        expect(await settlesWithin(Promise.all([locker, update]), HELD_MS)).toBe(false);
      } finally {
        await lock.release();
      }
      expect(await settlesWithin(Promise.all([locker, update]), HELD_MS * 5)).toBe(true);
    });
  }
});
