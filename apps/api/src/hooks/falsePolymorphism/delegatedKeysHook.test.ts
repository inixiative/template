import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import {
  buildToken,
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createToken,
} from '@template/db/test';
import { registerDelegatedKeysHook } from '#/hooks/falsePolymorphism/delegatedKeysHook';

describe("an integration's token carries its integration's keys (Aron, 2026-10-25)", () => {
  beforeAll(() => registerDelegatedKeysHook());

  afterAll(async () => {
    unregisterDbHook('falsePolymorphism:delegatedKeys');
    unregisterDbHook('falsePolymorphism:delegatedKeys:upsert');
    await cleanupTouchedTables(db);
  });

  const seatIntegration = async () => {
    const { entity: seat } = await createOrganizationUser({ role: 'owner' });
    const { entity: integration } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: seat.organizationId,
      userId: seat.userId,
    });
    return integration;
  };

  it('the factory and the hook write the same keys, whatever the caller passed', async () => {
    const integration = await seatIntegration();
    const { entity: elsewhere } = await createOrganization();
    const carried = {
      integrationId: integration.id,
      organizationId: integration.organizationId,
      userId: integration.userId,
      spaceId: null,
    };

    const { entity: built } = await buildToken(
      { ownerModel: 'Integration', organizationId: elsewhere.id },
      { integration },
    );
    const { entity: created } = await createToken(
      { ownerModel: 'Integration', organizationId: elsewhere.id },
      { integration },
    );

    expect(built).toMatchObject(carried);
    expect(created).toMatchObject(carried);
    expect(await db.token.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject(carried);
  });

  it("an organization's integration gives its tokens the organization and no user", async () => {
    const { entity: organization } = await createOrganization();
    const { entity: integration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: token } = await createToken({ ownerModel: 'Integration' }, { integration });
    expect(token).toMatchObject({ organizationId: organization.id, userId: null, spaceId: null });
  });
});
