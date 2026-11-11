import { afterEach, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { db } from '@template/db/client';
import {
  loadEntitlementAnchors,
  missingAnchors,
} from '@template/db/entitlements/entitlementAnchors';
import {
  type EntitlementInput,
  toEntitlementCreateData,
} from '@template/db/entitlements/entitlementRow';
import type { Entitlement } from '@template/db/generated/client/client';
import { fetchOne } from '@template/db/hydrate/fetchOne';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
  storeEntitlements,
} from '@template/db/test';

const stored = ({ resource, actions, where, sourceModel, sourceId, sourcePath }: Entitlement) => ({
  resource,
  actions,
  where,
  sourceModel,
  sourceId,
  sourcePath,
});

describe('an entitlement row is stored as it was given (Aron, 2026-11-10)', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('a holder read through fetchOne carries its live rows, in the order granted', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization });
    const inputs: EntitlementInput[] = [
      { resource: 'Space', actions: ['manage'], sourceModel: 'Space', sourceId: space.id },
      {
        resource: 'Integration',
        actions: ['read', 'operate'],
        where: { field: 'ownerModel', operator: Operator.equals, value: 'Organization' },
        sourceModel: 'Organization',
        sourceId: organization.id,
        sourcePath: 'organization',
      },
    ];
    const { entity: token } = await createToken(
      { ownerModel: 'Organization', entitlements: inputs },
      { organization },
    );

    const loaded = await fetchOne<{ id: string; targetEntitlements: Entitlement[] }>(
      'token',
      token.id,
    );
    expect(loaded?.targetEntitlements.map(stored)).toEqual([
      { ...inputs[0], where: null, sourcePath: null },
      inputs[1],
    ] as ReturnType<typeof stored>[]);
  });

  it('fills the typed and plain ids on both ends', () => {
    const [row] = toEntitlementCreateData(
      [{ resource: 'Organization', actions: ['read'], sourceModel: 'Organization', sourceId: 'o' }],
      { model: 'Integration', row: { id: 'i' } },
      { 'Organization:o': { id: 'o', deletedAt: null } },
    );
    expect(row).toEqual({
      resource: 'Organization',
      actions: ['read'],
      sourceModel: 'Organization',
      sourceOrganizationId: 'o',
      sourceId: 'o',
      sourcePath: null,
      sourceDeletedAt: null,
      targetModel: 'Integration',
      targetIntegrationId: 'i',
      targetId: 'i',
    });
  });

  it("a member arm carries the member's whole owner chain, its id materialized", async () => {
    const { entity: organization } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization });
    const { entity: spaceUser } = await createSpaceUser({}, { organization, space });
    const { entity: organizationUser } = await createOrganizationUser({}, { organization });

    const inputs: EntitlementInput[] = [
      {
        resource: 'Space',
        actions: ['read'],
        sourceModel: 'OrganizationUser',
        sourceId: organizationUser.id,
      },
    ];
    const [row] = toEntitlementCreateData(
      inputs,
      { model: 'SpaceUser', row: spaceUser },
      await loadEntitlementAnchors(inputs),
    );
    expect(row).toMatchObject({
      sourceModel: 'OrganizationUser',
      sourceId: organizationUser.id,
      sourceOrganizationId: organization.id,
      sourceUserId: organizationUser.userId,
      targetModel: 'SpaceUser',
      targetId: spaceUser.id,
      targetOrganizationId: organization.id,
      targetSpaceId: space.id,
      targetUserId: spaceUser.userId,
    });
  });

  it("an anchor's tombstone is copied onto the row it anchors", async () => {
    const { entity: organization } = await createOrganization();
    const { entity: token } = await createToken({ ownerModel: 'Organization' }, { organization });
    const { entity: anchor } = await createOrganizationUser({}, { organization });
    const { deletedAt } = await db.organizationUser.update({
      where: { id: anchor.id },
      data: { deletedAt: new Date() },
    });

    const [row] = await storeEntitlements({ model: 'Token', row: token }, [
      {
        resource: 'Space',
        actions: ['read'],
        sourceModel: 'OrganizationUser',
        sourceId: anchor.id,
      },
    ]);
    expect(row).toMatchObject({
      sourceId: anchor.id,
      sourceOrganizationId: organization.id,
      sourceUserId: anchor.userId,
      sourceDeletedAt: deletedAt,
    });
  });

  it('an anchor that does not exist is missing, not loaded', async () => {
    const inputs: EntitlementInput[] = [
      {
        resource: 'Space',
        actions: ['read'],
        sourceModel: 'SpaceUser',
        sourceId: 'no-such-member',
      },
    ];
    expect(missingAnchors(inputs, await loadEntitlementAnchors(inputs))).toEqual(inputs);
  });

  it('a target with no rows holds none', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: token } = await createToken({ ownerModel: 'Organization' }, { organization });
    expect(await storeEntitlements({ model: 'Token', row: token }, [])).toEqual([]);
    expect(
      (await fetchOne<{ id: string; targetEntitlements: Entitlement[] }>('token', token.id))
        ?.targetEntitlements,
    ).toEqual([]);
  });
});
