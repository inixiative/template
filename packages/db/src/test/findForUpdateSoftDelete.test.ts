import { afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { IntegrationResource } from '@template/db/generated/client/client';
import {
  createIntegration,
  createIntegrationResource,
  createUser,
} from '@template/db/test/factories';
import { cleanupTouchedTables } from '@template/db/test/testTracker';

const createResource = async () => {
  const { entity: user } = await createUser();
  const { entity: integration } = await createIntegration({ ownerModel: 'User', userId: user.id });
  return createIntegrationResource({}, { integration });
};

const lockResource = (id: string) =>
  db.txn(() => db.findForUpdate<IntegrationResource>('IntegrationResource', { id }));

describe('db.findForUpdate on a soft-delete model', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('locks and returns live rows only', async () => {
    const { entity: live } = await createResource();
    const { entity: removed } = await createResource();
    await db.integrationResource.update({
      where: { id: removed.id },
      data: { deletedAt: new Date() },
    });

    expect((await lockResource(live.id)).map((row) => row.id)).toEqual([live.id]);
    expect(await lockResource(removed.id)).toEqual([]);
  });

  it('returns tombstones inside db.withDeleted, or when the where names deletedAt', async () => {
    const { entity: removed } = await createResource();
    const { deletedAt } = await db.integrationResource.update({
      where: { id: removed.id },
      data: { deletedAt: new Date() },
    });

    expect(await db.withDeleted(() => lockResource(removed.id))).toHaveLength(1);
    expect(
      await db.txn(() =>
        db.findForUpdate<IntegrationResource>('IntegrationResource', {
          id: removed.id,
          deletedAt,
        }),
      ),
    ).toHaveLength(1);
  });

  it('re-adds a removed key under the upserting fence', async () => {
    const { entity: removed } = await createResource();
    await db.integrationResource.update({
      where: { id: removed.id },
      data: { deletedAt: new Date() },
    });
    const key = {
      integrationId: removed.integrationId,
      kind: removed.kind,
      externalId: removed.externalId,
    };

    const again = await db.txn(async () => {
      const [existing] = await db.findForUpdate<IntegrationResource>('IntegrationResource', key, {
        upserting: true,
      });
      return (
        existing ?? db.integrationResource.create({ data: { ...key, name: 'Again', metadata: {} } })
      );
    });

    expect(again.id).not.toBe(removed.id);
  });

  it('waits on a revive in flight on the key and returns the revived row', async () => {
    const { entity: removed } = await createResource();
    await db.integrationResource.update({
      where: { id: removed.id },
      data: { deletedAt: new Date() },
    });
    let reviving!: () => void;
    const revived = new Promise<void>((resolve) => {
      reviving = resolve;
    });

    const [, found] = await Promise.all([
      db.txn(async () => {
        await db.withDeleted(() =>
          db.integrationResource.update({ where: { id: removed.id }, data: { deletedAt: null } }),
        );
        reviving();
        await new Promise((resolve) => setTimeout(resolve, 200));
      }),
      revived.then(() => lockResource(removed.id)),
    ]);

    expect(found.map((row) => row.id)).toEqual([removed.id]);
  });

  it('reads a deletedAt: null predicate as IS NULL', async () => {
    const { entity: live } = await createResource();
    expect(
      await db.txn(() =>
        db.findForUpdate<IntegrationResource>('IntegrationResource', {
          id: live.id,
          deletedAt: null,
        }),
      ),
    ).toHaveLength(1);
  });
});
