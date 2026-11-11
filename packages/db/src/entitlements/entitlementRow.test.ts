import { afterEach, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { db } from '@template/db/client';
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

  it('fills the typed and plain ids on both ends', async () => {
    const [row] = await toEntitlementCreateData(
      [{ resource: 'Organization', actions: ['read'], sourceModel: 'Organization', sourceId: 'o' }],
      { model: 'Integration', id: 'i' },
    );
    expect(row).toEqual({
      resource: 'Organization',
      actions: ['read'],
      sourceModel: 'Organization',
      sourceOrganizationId: 'o',
      sourceId: 'o',
      sourcePath: null,
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

    const [row] = await toEntitlementCreateData(
      [
        {
          resource: 'Space',
          actions: ['read'],
          sourceModel: 'OrganizationUser',
          sourceId: organizationUser.id,
        },
      ],
      { model: 'SpaceUser', id: spaceUser.id },
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

  it('a target with no rows holds none', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: token } = await createToken({ ownerModel: 'Organization' }, { organization });
    expect(await storeEntitlements({ model: 'Token', id: token.id }, [])).toEqual([]);
    expect(
      (await fetchOne<{ id: string; targetEntitlements: Entitlement[] }>('token', token.id))
        ?.targetEntitlements,
    ).toEqual([]);
  });
});
