import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db/client';
import { DbAction, registerDbInvariant, unregisterDbInvariant } from '@template/db/extensions/mutationLifeCycle';
import { createOrganization, createUser } from '@template/db/test/factories';

const INVARIANT_NAME = 'test:userNameInvariant';
const GLOBAL_INVARIANT_NAME = 'test:globalDataWriteInvariant';
const REJECTION = 'user name is blocked';

const bulkEmail = () => `bulk-${crypto.randomUUID()}@example.com`;

describe('registerDbInvariant', () => {
  beforeEach(() => {
    registerDbInvariant(INVARIANT_NAME, 'User', ({ action, data }) => {
      if (action !== DbAction.update) return;
      if ((data as { name?: unknown }).name === 'blocked') throw new Error(REJECTION);
    });
  });

  afterEach(() => {
    unregisterDbInvariant(INVARIANT_NAME);
  });

  it('enforces an invariant on non-transactional writes and allows valid data', async () => {
    const { entity: user } = await createUser({ name: 'Original' });

    expect(db.isInTxn()).toBe(false);
    await expect(db.user.update({ where: { id: user.id }, data: { name: 'blocked' } })).rejects.toThrow(REJECTION);

    const unchanged = await db.raw.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchanged.name).toBe('Original');

    const updated = await db.user.update({ where: { id: user.id }, data: { name: 'Allowed' } });
    expect(updated.name).toBe('Allowed');
  });

  it('enforces an invariant inside db.txn', async () => {
    const { entity: user } = await createUser({ name: 'Original' });

    await expect(db.txn(() => db.user.update({ where: { id: user.id }, data: { name: 'blocked' } }))).rejects.toThrow(
      REJECTION,
    );

    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.name).toBe('Original');
  });

  it('unregisters only the named registration when two registrations share a callback', async () => {
    const { entity: user } = await createUser({ name: 'Original' });
    let invocationCount = 0;
    const invariant = () => {
      invocationCount += 1;
    };
    registerDbInvariant('test:sharedCallbackFirst', 'User', invariant);
    registerDbInvariant('test:sharedCallbackSecond', 'User', invariant);
    unregisterDbInvariant('test:sharedCallbackFirst');

    try {
      await db.user.update({ where: { id: user.id }, data: { name: 'Updated' } });

      expect(invocationCount).toBe(1);
    } finally {
      unregisterDbInvariant('test:sharedCallbackFirst');
      unregisterDbInvariant('test:sharedCallbackSecond');
    }
  });

  it("runs a model and '*' registration once per matching write", async () => {
    const { entity: user } = await createUser({ name: 'Original' });
    const { entity: organization } = await createOrganization();
    const invokedModels: string[] = [];
    registerDbInvariant('test:modelAndGlobal', ['User', '*'], ({ model }) => {
      invokedModels.push(model);
    });

    try {
      await db.user.update({ where: { id: user.id }, data: { name: 'Updated' } });
      await db.organization.update({ where: { id: organization.id }, data: { name: 'Updated' } });

      expect(invokedModels).toEqual(['User', 'Organization']);
    } finally {
      unregisterDbInvariant('test:modelAndGlobal');
    }
  });

  it('runs a global invariant on bulk writes but not deletes', async () => {
    const { entity: deleteManyUser } = await createUser();
    const actions: DbAction[] = [];
    registerDbInvariant(GLOBAL_INVARIANT_NAME, '*', ({ action }) => {
      actions.push(action);
    });

    try {
      const [bulkUser] = await db.user.createManyAndReturn({ data: [{ email: bulkEmail(), name: 'Bulk' }] });
      if (!bulkUser) throw new Error('Expected createManyAndReturn to return the created user');
      await db.user.updateManyAndReturn({ where: { id: bulkUser.id }, data: { name: 'Bulk Updated' } });

      expect(actions).toEqual([DbAction.createManyAndReturn, DbAction.updateManyAndReturn]);

      await db.user.delete({ where: { id: bulkUser.id } });
      await db.user.deleteMany({ where: { id: deleteManyUser.id } });

      expect(actions).toEqual([DbAction.createManyAndReturn, DbAction.updateManyAndReturn]);
    } finally {
      unregisterDbInvariant(GLOBAL_INVARIANT_NAME);
    }
  });
});
