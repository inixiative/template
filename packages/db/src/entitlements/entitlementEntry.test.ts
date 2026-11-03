import { afterAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import type { EntitlementEntry } from '@inixiative/permissions';
import { db } from '@template/db/client';
import { toEntitlementRow } from '@template/db/entitlements/entitlementEntry';
import {
  includeTargetEntitlements,
  withEntitlementEntries,
} from '@template/db/entitlements/targetEntitlements';
import { fetchOne } from '@template/db/hydrate/fetchOne';
import {
  cleanupTouchedTables,
  createOrganization,
  createSpace,
  createToken,
  storeEntitlements,
} from '@template/db/test';

describe('an entitlement row is the entry it stores, exactly (Aron, 2026-11-02)', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const entriesUnder = async () => {
    const { entity: organization } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization });
    const selfAnchored: EntitlementEntry = {
      resource: 'db:space',
      anchor: { resource: 'db:space', id: space.id },
      actions: { manage: true },
    };
    const pathAndWhere: EntitlementEntry = {
      resource: 'db:integration',
      anchor: { resource: 'db:organization', id: organization.id, path: 'organization' },
      where: { field: 'ownerModel', operator: Operator.equals, value: 'Organization' },
      actions: { read: true, operate: true },
    };
    return { organization, entries: [selfAnchored, pathAndWhere] };
  };

  it('a stored target reads back the entries it was given, in the order granted: no path or where when it had none, actions as a map', async () => {
    const { organization, entries } = await entriesUnder();
    const { entity: token } = await createToken({ ownerModel: 'Organization' }, { organization });
    await storeEntitlements({ model: 'Token', id: token.id }, entries);

    const loaded = await db.token.findUniqueOrThrow({
      where: { id: token.id },
      include: includeTargetEntitlements,
    });
    expect(withEntitlementEntries(loaded).entitlements).toEqual(entries);
    expect(
      (await fetchOne<{ id: string; entitlements: EntitlementEntry[] }>('token', token.id))
        ?.entitlements,
    ).toEqual(entries);
  });

  it('stores the held actions only, with the typed and plain ids on both ends', () => {
    const row = toEntitlementRow(
      {
        resource: 'db:organization',
        anchor: { resource: 'db:organization', id: 'o' },
        actions: { read: true, manage: false },
      },
      { model: 'Integration', id: 'i' },
    );
    expect(row.actions).toEqual(['read']);
    expect(row).toMatchObject({
      sourceModel: 'Organization',
      sourceOrganizationId: 'o',
      sourceId: 'o',
      sourcePath: null,
      targetModel: 'Integration',
      targetIntegrationId: 'i',
      targetId: 'i',
    });
  });
});
