import { describe, expect, it } from 'bun:test';
import type { HydratedRecord } from '@template/db';
import { createPermissions, type PermissionEntry, type Permix } from '@template/permissions/client';
import { check } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';

const u1 = { id: 'u1' };
const o1 = { id: 'o1' };
const o9 = { id: 'o9' };
const s1 = { id: 's1', organizationId: 'o1', organization: o1 };
const s2 = { id: 's2', organizationId: 'o1', organization: o1 };
const s1Moved = { id: 's1', organizationId: 'o9', organization: o9 };
const seatRow = {
  id: 'r1',
  role: 'member',
  userId: 'u1',
  organizationId: 'o1',
  user: u1,
  organization: o1,
};

const roleActions = {
  viewer: ['read'],
  member: ['read', 'operate'],
  admin: ['read', 'operate', 'manage'],
  owner: ['read', 'operate', 'manage', 'own'],
} as const;
type Role = keyof typeof roleActions;

const all = (actions: readonly string[]) => Object.fromEntries(actions.map((a) => [a, true]));
const on = (resource: string, id: string) => ({ resource, id });

const entitle = (
  resource: string,
  anchor: { resource: string; id: string },
  actions: readonly string[],
): PermissionEntry => ({ resource, anchor, actions: all(actions) }) as PermissionEntry;

const organization = async (org = o1) => {
  const permix = createPermissions();
  await permix.setup({ resource: 'db:organization', id: org.id, actions: { own: true } });
  return permix;
};

const seat = async (role: Role, granted: PermissionEntry[] = [], grantor?: Permix) => {
  const permix = createPermissions();
  await permix.setup({ resource: 'db:organization', id: 'o1', actions: all(roleActions[role]) });
  if (granted.length) await permix.setup(granted, { owner: grantor ?? (await organization()) });
  return permix;
};

const heldBy = async (owner: Permix, granted: PermissionEntry[]) => {
  const permix = createPermissions();
  await permix.setup(granted, { owner });
  return permix;
};

const can = (permix: Permix, model: Parameters<typeof check>[2], record: object, action: string) =>
  check(permix, rebacSchema, model, record as HydratedRecord, action);

const fromO1 = on('db:organization', 'o1');
const fromO9 = on('db:organization', 'o9');
const fromS1 = on('db:space', 's1');
const fromSeat = on('db:organizationUser', 'r1');

describe('delegation: an integration acts for its direct owner, never past it (Aron, 2026-10-25)', () => {
  describe('an integration of an organization seat, granted against the organization by the seat', () => {
    it('holds what the seat holds there', async () => {
      const integration = await heldBy(await seat('member'), [
        entitle('db:organization', fromO1, ['read', 'operate']),
      ]);
      expect(can(integration, 'organization', o1, 'operate')).toBe(true);
      expect(can(integration, 'organization', o1, 'read')).toBe(true);
    });

    it('holds nothing above the seat, whatever it was given', async () => {
      const integration = await heldBy(await seat('member'), [
        entitle('db:organization', fromO1, ['manage', 'own']),
      ]);
      expect(can(integration, 'organization', o1, 'manage')).toBe(false);
      expect(can(integration, 'organization', o1, 'own')).toBe(false);
    });

    it("an admin seat's integration manages and does not own", async () => {
      const integration = await heldBy(await seat('admin'), [
        entitle('db:organization', fromO1, ['manage', 'own']),
      ]);
      expect(can(integration, 'organization', o1, 'manage')).toBe(true);
      expect(can(integration, 'organization', o1, 'own')).toBe(false);
    });

    it('holds only the actions it was given, though the seat holds more', async () => {
      const integration = await heldBy(await seat('admin'), [
        entitle('db:organization', fromO1, ['read']),
      ]);
      expect(can(integration, 'organization', o1, 'read')).toBe(true);
      expect(can(integration, 'organization', o1, 'operate')).toBe(false);
    });

    it('reaches no other organization, even one its person sits in', async () => {
      const integration = await heldBy(await seat('owner'), [
        entitle('db:organization', fromO1, ['read']),
        entitle('db:organization', fromO9, ['read']),
      ]);
      expect(can(integration, 'organization', o9, 'read')).toBe(false);
    });
  });

  describe("two sources: the seat's own entitlement from the organization, and the seat's grant to its integration", () => {
    const manageS1 = entitle('db:space', fromS1, ['read', 'operate', 'manage']);

    it('a member seat the organization let manage s1 passes that on to its integration', async () => {
      const integration = await heldBy(await seat('member', [manageS1]), [manageS1]);
      expect(can(integration, 'space', s1, 'manage')).toBe(true);
      expect(can(integration, 'space', s2, 'manage')).toBe(false);
    });

    it('the seat without that entitlement passes on nothing on s1, its role still stands on the organization', async () => {
      const integration = await heldBy(await seat('member'), [
        manageS1,
        entitle('db:organization', fromO1, ['read', 'operate']),
      ]);
      expect(can(integration, 'space', s1, 'manage')).toBe(false);
      expect(can(integration, 'organization', o1, 'operate')).toBe(true);
    });

    it('an entitlement the seat got from someone who no longer holds it grounds nothing', async () => {
      const integration = await heldBy(await seat('member', [manageS1], createPermissions()), [
        manageS1,
      ]);
      expect(can(integration, 'space', s1, 'manage')).toBe(false);
    });

    it('s1 moved to another organization: the chain stops at the seat, no fetch', async () => {
      const integration = await heldBy(await seat('member', [manageS1]), [manageS1]);
      expect(can(integration, 'space', s1Moved, 'manage')).toBe(false);
    });

    it('an entitlement on the seat itself reaches the seat row, not the organization', async () => {
      const integration = await heldBy(await seat('member'), [
        entitle('db:organizationUser', fromSeat, ['read']),
      ]);
      expect(can(integration, 'organizationUser', seatRow, 'read')).toBe(true);
      expect(can(integration, 'organization', o1, 'read')).toBe(false);
    });
  });

  describe('a token of the integration: token ← integration ← seat ← organization', () => {
    const operateO1 = entitle('db:organization', fromO1, ['read', 'operate']);
    const readO1 = entitle('db:organization', fromO1, ['read']);
    const manageO1 = entitle('db:organization', fromO1, ['read', 'operate', 'manage']);

    it('narrower than the integration: only the narrower action', async () => {
      const token = await heldBy(await heldBy(await seat('member'), [operateO1]), [readO1]);
      expect(can(token, 'organization', o1, 'read')).toBe(true);
      expect(can(token, 'organization', o1, 'operate')).toBe(false);
    });

    it('wider than the integration: only what the integration holds', async () => {
      const token = await heldBy(await heldBy(await seat('admin'), [readO1]), [manageO1]);
      expect(can(token, 'organization', o1, 'read')).toBe(true);
      expect(can(token, 'organization', o1, 'operate')).toBe(false);
      expect(can(token, 'organization', o1, 'manage')).toBe(false);
    });

    it('the weakest link wins: an admin token through a member seat', async () => {
      const token = await heldBy(await heldBy(await seat('member'), [manageO1]), [manageO1]);
      expect(can(token, 'organization', o1, 'operate')).toBe(true);
      expect(can(token, 'organization', o1, 'manage')).toBe(false);
    });

    it('an integration holding nothing in the middle: nothing', async () => {
      const token = await heldBy(await heldBy(await seat('owner'), []), [manageO1]);
      expect(can(token, 'organization', o1, 'read')).toBe(false);
    });

    it("the organization's own grant is what the whole chain stands on", async () => {
      const manageS1 = entitle('db:space', fromS1, ['read', 'operate', 'manage']);
      const token = await heldBy(await heldBy(await seat('member', [manageS1]), [manageS1]), [
        manageS1,
      ]);
      expect(can(token, 'space', s1, 'manage')).toBe(true);
      expect(can(token, 'space', s1Moved, 'manage')).toBe(false);
    });
  });
});
