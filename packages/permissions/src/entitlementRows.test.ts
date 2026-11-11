import { describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import type { EntitlementEntry } from '@template/permissions/client';
import {
  entitlementsOf,
  toEntitlementEntry,
  toEntitlementInput,
} from '@template/permissions/entitlementRows';

const selfAnchored: EntitlementEntry = {
  resource: 'db:space',
  anchor: { resource: 'db:space', id: 's' },
  actions: { manage: true },
};

const pathAndWhere: EntitlementEntry = {
  resource: 'db:integration',
  anchor: { resource: 'db:organization', id: 'o', path: 'organization' },
  where: { field: 'ownerModel', operator: Operator.equals, value: 'Organization' },
  actions: { read: true, operate: true },
};

describe('a row is the entry it stores, exactly (Aron, 2026-11-10)', () => {
  it('a row reads back as the entry it was written from: no path or where when it had none, actions as a map', () => {
    for (const entry of [selfAnchored, pathAndWhere])
      expect(toEntitlementEntry(toEntitlementInput(entry))).toEqual(entry);
  });

  it('an entry is written with its held actions only, as model names', () => {
    expect(
      toEntitlementInput({
        resource: 'db:organizationUser',
        anchor: { resource: 'db:organization', id: 'o' },
        actions: { read: true, manage: false },
      }),
    ).toEqual({
      resource: 'OrganizationUser',
      actions: ['read'],
      sourceModel: 'Organization',
      sourceId: 'o',
    });
  });

  it('a stored row with a null where and path reads as an entry without them', () => {
    expect(
      toEntitlementEntry({
        resource: 'Space',
        actions: ['manage'],
        where: null,
        sourceModel: 'Space',
        sourceId: 's',
        sourcePath: null,
      }),
    ).toEqual(selfAnchored);
  });

  it('a holder grants the entries of its rows, and nothing without them', () => {
    expect(entitlementsOf({ targetEntitlements: [toEntitlementInput(selfAnchored)] })).toEqual([
      selfAnchored,
    ]);
    expect(entitlementsOf({})).toEqual([]);
    expect(entitlementsOf({ targetEntitlements: null })).toEqual([]);
  });
});
