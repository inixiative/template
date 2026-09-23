/**
 * @atlas
 * @kind test
 * @partOf infrastructure:prisma
 * @uses none
 */
import { describe, expect, it } from 'bun:test';
import { db } from '@template/db/client';
import { ContactType, JobLane } from '@template/db/generated/client/enums';
import { createContact, createJobOutbox, createUser } from '@template/db/test/factories';

describe('db.findForUpdate options', () => {
  const lockOldestSlow = () =>
    db.findForUpdate<{ jobId: string }>(
      'JobOutbox',
      { lane: JobLane.slow, attempts: { lt: 5 } },
      { orderBy: { id: 'asc' }, take: 1, skipLocked: true },
    );

  it('filters with lt, orders, limits, and skips rows another transaction holds', async () => {
    const tag = crypto.randomUUID();
    await createJobOutbox({ jobId: `${tag}-fast`, lane: JobLane.fast });
    await createJobOutbox({ jobId: `${tag}-quarantined`, lane: JobLane.slow, attempts: 5 });
    await createJobOutbox({ jobId: `${tag}-first`, lane: JobLane.slow });
    await createJobOutbox({ jobId: `${tag}-second`, lane: JobLane.slow });

    let releaseFirst: () => void = () => {};
    const firstHolds = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markFirstLocked: () => void = () => {};
    const firstLocked = new Promise<void>((resolve) => {
      markFirstLocked = resolve;
    });

    const first = db.parallel([
      () =>
        db.txn(async () => {
          const rows = await lockOldestSlow();
          markFirstLocked();
          await firstHolds;
          return rows.map((row) => row.jobId);
        }),
    ]);
    await firstLocked;
    const [second] = await db.parallel([() => db.txn(async () => (await lockOldestSlow()).map((row) => row.jobId))]);
    releaseFirst();
    const [firstRows] = await first;

    expect(firstRows).toEqual([`${tag}-first`]);
    expect(second).toEqual([`${tag}-second`]);
    await db.jobOutbox.deleteMany({ where: { jobId: { startsWith: tag } } });
  });

  it('rejects an order key the model does not have', async () => {
    await expect(
      db.txn(() => db.findForUpdate('JobOutbox', { lane: JobLane.slow }, { orderBy: { nope: 'asc' } })),
    ).rejects.toThrow("unknown field 'nope'");
  });

  it('rejects a take that is not a positive integer', async () => {
    await expect(db.txn(() => db.findForUpdate('JobOutbox', { lane: JobLane.slow }, { take: 0 }))).rejects.toThrow(
      'take must be a positive integer',
    );
  });
});

describe('db.parallel', () => {
  it('runs each branch in its own scope', async () => {
    const [a, b] = await db.parallel([async () => db.getScopeId(), async () => db.getScopeId()]);
    expect(a).not.toBeNull();
    expect(a).not.toBe(b);
  });

  it('rejects on the first failing branch by default', async () => {
    await expect(db.parallel([async () => 'ok', async () => Promise.reject(new Error('boom'))])).rejects.toThrow(
      'boom',
    );
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
