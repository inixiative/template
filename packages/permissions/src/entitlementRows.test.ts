import { describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import type { EntitlementEntry } from '@template/permissions/client';
import {
  entitlementsOf,
  sameEntitlement,
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
      { ...selfAnchored, grantsBelow: true },
    ]);
    expect(entitlementsOf({})).toEqual([]);
    expect(entitlementsOf({ targetEntitlements: null })).toEqual([]);
  });
});

describe('a row nothing narrows grants below its record (Aron, 2026-11-14)', () => {
  const row = { ...toEntitlementInput(selfAnchored), where: null, lens: null };

  it('a row with no where and no lens is marked', () => {
    expect(entitlementsOf({ targetEntitlements: [row] })).toEqual([
      { ...selfAnchored, grantsBelow: true },
    ]);
  });

  it('a lensed row is not, nor a row with a where', () => {
    expect(entitlementsOf({ targetEntitlements: [{ ...row, lens: { fields: ['id'] } }] })).toEqual([
      selfAnchored,
    ]);
    expect(entitlementsOf({ targetEntitlements: [toEntitlementInput(pathAndWhere)] })).toEqual([
      pathAndWhere,
    ]);
  });

  it('the mark is no part of what a row grants: a lensed row and its unlensed twin stay the same grant', () => {
    expect(sameEntitlement(row, { ...row, lens: { fields: ['id'] } })).toBe(true);
    expect(toEntitlementEntry(row)).toEqual(selfAnchored);
  });
});

describe('one grant, one lens (Aron, 2026-11-12)', () => {
  it('rows are the same grant when resource, anchor, path, where and actions match, whatever their lens or action order', () => {
    const row = toEntitlementInput(pathAndWhere);
    const lensed = { ...row, actions: [...row.actions].reverse(), lens: { fields: ['id'] } };
    expect(sameEntitlement(row, lensed)).toBe(true);
    expect(sameEntitlement(row, { ...row, sourcePath: null })).toBe(false);
    expect(sameEntitlement(row, { ...row, where: null })).toBe(false);
    expect(sameEntitlement(row, { ...row, actions: ['read'] })).toBe(false);
    expect(sameEntitlement(row, { ...row, sourceId: 'other' })).toBe(false);
  });
});
