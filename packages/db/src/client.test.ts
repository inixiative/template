/**
 * @atlas
 * @kind test
 * @partOf infrastructure:prisma
 * @uses none
 */
import { describe, expect, it } from 'bun:test';
import { db } from '@template/db/client';
import { ContactType } from '@template/db/generated/client/enums';
import { createContact, createUser } from '@template/db/test/factories';

describe('db.parallel', () => {
  it('runs each branch in its own scope', async () => {
    const [a, b] = await db.parallel([async () => db.getScopeId(), async () => db.getScopeId()]);
    expect(a).not.toBeNull();
    expect(a).not.toBe(b);
  });

  it('rejects on the first failing branch by default', async () => {
    await expect(
      db.parallel([async () => 'ok', async () => Promise.reject(new Error('boom'))]),
    ).rejects.toThrow('boom');
  });

  it('captures per-branch failures with resolution allSettled', async () => {
    const results = await db.parallel([async () => 'ok', async () => Promise.reject(new Error('boom'))], {
      resolution: 'allSettled',
    });
    expect(results[0]).toEqual({ status: 'fulfilled', value: 'ok' });
    expect(results[1]?.status).toBe('rejected');
  });

  it('throws when called inside a transaction', async () => {
    await expect(
      db.txn(async () => {
        await db.parallel([async () => 1]);
      }),
    ).rejects.toThrow(/cannot run inside a transaction/);
  });

  it('isolates each concurrent afterCommit callback into its own transaction', async () => {
    const { entity: user } = await createUser();
    const ids: string[] = [];
    await db.txn(async () => {
      db.onCommit([
        async () => {
          const { entity } = await createContact({ ownerModel: 'User' }, { user });
          await db.contact.update({ where: { id: entity.id }, data: { type: ContactType.phone } });
          ids.push(entity.id);
        },
        async () => {
          const { entity } = await createContact({ ownerModel: 'User' }, { user });
          await db.contact.update({ where: { id: entity.id }, data: { type: ContactType.phone } });
          ids.push(entity.id);
        },
      ]);
    });

    expect(ids).toHaveLength(2);
    const rows = await db.contact.findMany({ where: { id: { in: ids } } });
    expect(rows.every((row) => row.type === ContactType.phone)).toBe(true);
  });
});
