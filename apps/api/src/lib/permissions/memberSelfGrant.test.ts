import { describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import type { HydratedRecord, OrganizationId, UserId } from '@template/db';
import { type Grant, getOrgPermissions, grantsPermix, userGrants } from '@template/permissions';
import type { EntitlementEntry } from '@template/permissions/client';
import { check } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { getUserPermissions } from '@template/permissions/roles/user';
import { delegateTable } from '#/lib/permissions/ownerTable';

const o1 = { id: 'o1' };
const u1 = { id: 'u1' };
const u2 = { id: 'u2' };
const m1 = {
  id: 'm1',
  role: 'member' as const,
  userId: u1.id,
  organizationId: o1.id,
  user: u1,
  organization: o1,
};
const m2 = {
  id: 'm2',
  role: 'member' as const,
  userId: u2.id,
  organizationId: o1.id,
  user: u2,
  organization: o1,
};

const operateOn = (memberId: string): EntitlementEntry => ({
  resource: 'db:organizationUser',
  anchor: { resource: 'db:organizationUser', id: memberId },
  actions: { operate: true },
});

const memberTable = (member: typeof m1): Grant[] => [
  { entries: [getOrgPermissions('member', member.organizationId as OrganizationId)] },
  {
    entries: [operateOn(member.id)],
    owner: [{ entries: [getUserPermissions(member.userId as UserId)] }],
  },
];

const operatesM1 = async (grants: Grant[]) =>
  check(
    await grantsPermix(grants),
    rebacSchema,
    'organizationUser',
    m1 as unknown as HydratedRecord,
    'operate',
  );

describe("design: M1's self-grant, backed by U1, is read by M1's full token and no one else (Aron, 2026-10-30)", () => {
  it('a full token on M1 reads it: it operates M1', async () => {
    expect(await operatesM1(delegateTable({ full: true }, memberTable(m1)))).toBe(true);
  });

  it('a role token on M1 does not', async () => {
    expect(await operatesM1(delegateTable({ role: 'owner' }, memberTable(m1)))).toBe(false);
  });

  it('a role token on M1 given operate on M1 by hand does', async () => {
    expect(
      await operatesM1(
        delegateTable(
          { role: 'member' as const, entitlements: [operateOn(m1.id)] },
          memberTable(m1),
        ),
      ),
    ).toBe(true);
  });

  it("O1's owner does not", async () => {
    expect(
      await operatesM1([{ entries: [getOrgPermissions('owner', o1.id as OrganizationId)] }]),
    ).toBe(false);
  });

  it("a full token on another member M2 does not, even holding M2's own self-grant", async () => {
    expect(await operatesM1(delegateTable({ full: true }, memberTable(m2)))).toBe(false);
  });

  it('the same self-grant backed by O1 instead of U1 is not read', async () => {
    const backedByO1: Grant[] = [
      { entries: [getOrgPermissions('member', o1.id as OrganizationId)] },
      {
        entries: [operateOn(m1.id)],
        owner: [{ entries: [getOrgPermissions('owner', o1.id as OrganizationId)] }],
      },
    ];
    expect(await operatesM1(delegateTable({ full: true }, backedByO1))).toBe(false);
  });

  it("anchored on U1 instead of M1, M1's full token would also operate U1's member M3 in another org", async () => {
    const o2 = { id: 'o2' };
    const m3 = { ...m1, id: 'm3', organizationId: o2.id, organization: o2 };
    const anchoredOnU1: Grant[] = [
      { entries: [getOrgPermissions('member', o1.id as OrganizationId)] },
      {
        entries: [
          {
            resource: 'db:organizationUser',
            anchor: { resource: 'db:user', id: u1.id, path: 'user' },
            actions: { operate: true },
          },
        ],
        owner: [{ entries: [getUserPermissions(u1.id as UserId)] }],
      },
    ];
    const full = await grantsPermix(delegateTable({ full: true }, anchoredOnU1));
    expect(
      check(full, rebacSchema, 'organizationUser', m3 as unknown as HydratedRecord, 'operate'),
    ).toBe(true);
  });

  it('anchored on U1 with a where pinning M1, it reaches M1 and not M3', async () => {
    const o2 = { id: 'o2' };
    const m3 = { ...m1, id: 'm3', organizationId: o2.id, organization: o2 };
    const pinnedToM1: Grant[] = [
      { entries: [getOrgPermissions('member', o1.id as OrganizationId)] },
      {
        entries: [
          {
            resource: 'db:organizationUser',
            anchor: { resource: 'db:user', id: u1.id, path: 'user' },
            where: { field: 'id', operator: Operator.equals, value: m1.id },
            actions: { operate: true },
          },
        ],
        owner: [{ entries: [getUserPermissions(u1.id as UserId)] }],
      },
    ];
    const full = await grantsPermix(delegateTable({ full: true }, pinnedToM1));
    expect(
      check(full, rebacSchema, 'organizationUser', m1 as unknown as HydratedRecord, 'operate'),
    ).toBe(true);
    expect(
      check(full, rebacSchema, 'organizationUser', m3 as unknown as HydratedRecord, 'operate'),
    ).toBe(false);
  });
});

describe("userGrants backs a member's entitlements by the anchor's side (Aron, 2026-10-30)", () => {
  const selfGrant = (member: typeof m1) => ({
    resource: 'db:organizationUser',
    anchor: { resource: 'db:user', id: member.userId, path: 'user' },
    where: { field: 'id', operator: Operator.equals, value: member.id },
    actions: { operate: true },
  });
  const tableOf = (member: typeof m1) =>
    userGrants(null, [{ ...member, entitlements: [selfGrant(member)] }], []);

  it("M1's own permissions operate M1, so its full token does", async () => {
    expect(await operatesM1(delegateTable({ full: true }, tableOf(m1)))).toBe(true);
  });

  it('a role token on M1 does not', async () => {
    expect(await operatesM1(delegateTable({ role: 'owner' }, tableOf(m1)))).toBe(false);
  });

  it("M2's own permissions do not operate M1", async () => {
    expect(await operatesM1(delegateTable({ full: true }, tableOf(m2)))).toBe(false);
  });

  it('an entitlement anchored on another user is backed by the tenant, not that user', async () => {
    const borrowed = { ...m2, entitlements: [selfGrant(m1)] };
    expect(await operatesM1(delegateTable({ full: true }, userGrants(null, [borrowed], [])))).toBe(
      false,
    );
  });
});
