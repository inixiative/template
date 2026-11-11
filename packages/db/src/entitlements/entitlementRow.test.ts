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
  createSpace,
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
    const row = toEntitlementCreateData(
      { resource: 'Organization', actions: ['read'], sourceModel: 'Organization', sourceId: 'o' },
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
