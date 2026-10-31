import { describe, expect, it } from 'bun:test';
import type { HydratedRecord } from '@template/db';
import {
  createPermissions,
  installPermissions,
  memberSelfGrant,
  type Permissions,
  permissionsOfUser,
} from '@template/permissions';
import { check } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { delegatedPermissions } from '#/lib/permissions/ownerPermissions';

const o1 = { id: 'o1' };
const o2 = { id: 'o2' };
const u1 = { id: 'u1' };
const u2 = { id: 'u2' };
const memberOf = (id: string, user: { id: string }, organization: { id: string }) => ({
  id,
  role: 'member' as const,
  userId: user.id,
  organizationId: organization.id,
  user,
  organization,
});
const m1 = memberOf('m1', u1, o1);
const m2 = memberOf('m2', u2, o1);
const m3 = memberOf('m3', u1, o2);

type Member = typeof m1;

const withSelfGrant = (member: Member) => ({
  ...member,
  entitlements: [memberSelfGrant('db:organizationUser', member)],
});

const permixOf = async (permissions: Permissions) => {
  const permix = createPermissions();
  await installPermissions(permix, permissions);
  return permix;
};

const operates = async (table: ReturnType<typeof delegatedPermissions>, member: Member) =>
  check(
    await permixOf(table),
    rebacSchema,
    'organizationUser',
    member as unknown as HydratedRecord,
    'operate',
  );

describe("only a member's self-grant is backed by its user", () => {
  it('a full token on M1 operates M1, and not M2 or M3', async () => {
    const table = delegatedPermissions(
      { full: true },
      permissionsOfUser(null, [withSelfGrant(m1)], []),
    );
    expect(await operates(table, m1)).toBe(true);
    expect(await operates(table, m2)).toBe(false);
    expect(await operates(table, m3)).toBe(false);
  });

  it('a role token on M1 does not operate M1', async () => {
    const table = delegatedPermissions(
      { role: 'owner' },
      permissionsOfUser(null, [withSelfGrant(m1)], []),
    );
    expect(await operates(table, m1)).toBe(false);
  });

  it("a wider entitlement anchored on M1's user stays backed by the tenant", async () => {
    const wider = {
      ...m1,
      entitlements: [
        {
          resource: 'db:organizationUser',
          anchor: { resource: 'db:user', id: u1.id, path: 'user' },
          actions: { operate: true },
        },
        { resource: 'db:user', anchor: { resource: 'db:user', id: u1.id }, actions: { own: true } },
      ],
    };
    const full = await permixOf(
      delegatedPermissions({ full: true }, permissionsOfUser(null, [wider], [])),
    );
    expect(
      check(full, rebacSchema, 'organizationUser', m3 as unknown as HydratedRecord, 'operate'),
    ).toBe(false);
    expect(check(full, rebacSchema, 'user', u1 as unknown as HydratedRecord, 'own')).toBe(false);
  });

  it("M1's self-grant stored on M2 is backed by the tenant, not U1", async () => {
    const borrowed = { ...m2, entitlements: [memberSelfGrant('db:organizationUser', m1)] };
    const table = delegatedPermissions({ full: true }, permissionsOfUser(null, [borrowed], []));
    expect(await operates(table, m1)).toBe(false);
  });
});
