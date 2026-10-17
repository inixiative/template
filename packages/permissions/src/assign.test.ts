import { describe, expect, it } from 'bun:test';
import type { OrganizationId } from '@template/db';
import { assignLevel, canAssign } from '@template/permissions/assign';
import { createPermissions, type Entitlements } from '@template/permissions/client';
import { getOrgPermissions } from '@template/permissions/roles/organization';
import type { Role } from '@template/permissions/types';

const orgId = 'org-1' as OrganizationId;
const owner = { model: 'organization' as const, record: { id: orgId } };

const assigner = async (role: Role, entitlements: Entitlements = null) => {
  const permix = createPermissions();
  await permix.setup(getOrgPermissions(role, orgId, entitlements));
  return permix;
};

describe('assignLevel', () => {
  it('takes each action at the lowest role that reaches it', () => {
    expect(assignLevel(null, { read: true })).toBe('viewer');
    expect(assignLevel(null, { operate: true })).toBe('member');
    expect(assignLevel(null, { manage: true })).toBe('admin');
    expect(assignLevel('member', { own: true })).toBe('owner');
  });

  it('counts a rule-gated action as owner and an unmapped custom key as member', () => {
    expect(assignLevel(null, { assign: true })).toBe('owner');
    expect(assignLevel(null, { 'report.export': true })).toBe('member');
  });
});

describe('canAssign: never more than the assigner holds, possibly less', () => {
  it('an admin assigns what it holds through its role', async () => {
    expect(canAssign(await assigner('admin'), owner, owner, 'member', { operate: true })).toBe(
      true,
    );
    expect(canAssign(await assigner('admin'), owner, owner, null, { read: true })).toBe(true);
  });

  it('an admin cannot assign a custom key it does not hold', async () => {
    expect(canAssign(await assigner('admin'), owner, owner, null, { 'report.export': true })).toBe(
      false,
    );
  });

  it('an admin holding the custom key assigns it', async () => {
    const permix = await assigner('admin', { 'report.export': true });
    expect(canAssign(permix, owner, owner, null, { 'report.export': true })).toBe(true);
  });

  it('an admin cannot assign owner-level power, held or not', async () => {
    expect(canAssign(await assigner('admin'), owner, owner, 'owner', null)).toBe(false);
    expect(
      canAssign(await assigner('admin', { assign: true }), owner, owner, null, { assign: true }),
    ).toBe(false);
  });

  it('an owner assigns what it holds, but not a custom key it does not hold', async () => {
    expect(canAssign(await assigner('owner'), owner, owner, 'owner', { own: true })).toBe(true);
    expect(canAssign(await assigner('owner'), owner, owner, null, { 'report.export': true })).toBe(
      false,
    );
  });
});
