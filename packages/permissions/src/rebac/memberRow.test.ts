import { describe, expect, it } from 'bun:test';
import type { HydratedRecord } from '@template/db';
import { createPermissions, type PermissionEntry } from '@template/permissions/client';
import { check } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';

const o1 = { id: 'o1' };
const s1 = { id: 's1', organizationId: 'o1', organization: o1 };
const u1 = { id: 'u1' };
const u2 = { id: 'u2' };

const orgRow = (id: string, user: { id: string }, role = 'member') => ({
  id,
  role,
  userId: user.id,
  organizationId: o1.id,
  user,
  organization: o1,
});
const spaceRow = (id: string, user: { id: string }, role = 'member') => ({
  id,
  role,
  userId: user.id,
  organizationId: o1.id,
  spaceId: s1.id,
  user,
  space: s1,
});

const grant = (resource: string, id: string, action: string): PermissionEntry => ({
  resource,
  id,
  actions: { [action]: true },
});

const person = async (user: { id: string }, ...entries: PermissionEntry[]) => {
  const permix = createPermissions();
  await permix.setup([grant('db:user', user.id, 'own'), ...entries]);
  return permix;
};

const can = (
  permix: Awaited<ReturnType<typeof person>>,
  model: 'organizationUser' | 'spaceUser',
  record: object,
  action: string,
) => check(permix, rebacSchema, model, record as HydratedRecord, action);

describe('a member row: operate is being the member, manage and own administer it (Aron, 2026-10-30)', () => {
  const mine = orgRow('r1', u1);
  const peers = orgRow('r2', u2);

  it('the member operates their own row, whatever their role', async () => {
    expect(
      can(
        await person(u1, grant('db:organization', 'o1', 'operate')),
        'organizationUser',
        mine,
        'operate',
      ),
    ).toBe(true);
    expect(
      can(
        await person(u1, grant('db:organization', 'o1', 'read')),
        'organizationUser',
        orgRow('r1', u1, 'viewer'),
        'operate',
      ),
    ).toBe(true);
  });

  it("a member does not operate a peer's row", async () => {
    const member = await person(u1, grant('db:organization', 'o1', 'operate'));
    expect(can(member, 'organizationUser', peers, 'operate')).toBe(false);
  });

  it("an admin does not operate a member's row", async () => {
    const admin = await person(u1, grant('db:organization', 'o1', 'manage'));
    expect(can(admin, 'organizationUser', peers, 'operate')).toBe(false);
  });

  it("the owner owns a member's row and does not operate it", async () => {
    const owner = await person(u1, grant('db:organization', 'o1', 'own'));
    expect(can(owner, 'organizationUser', peers, 'own')).toBe(true);
    expect(can(owner, 'organizationUser', peers, 'manage')).toBe(true);
    expect(can(owner, 'organizationUser', peers, 'operate')).toBe(false);
  });

  it('the member does not administer their own row', async () => {
    const member = await person(u1, grant('db:organization', 'o1', 'operate'));
    expect(can(member, 'organizationUser', mine, 'manage')).toBe(false);
  });

  it('the same on a space member row', async () => {
    const admin = await person(u1, grant('db:space', 's1', 'manage'));
    expect(can(admin, 'spaceUser', spaceRow('sr2', u2), 'manage')).toBe(true);
    expect(can(admin, 'spaceUser', spaceRow('sr2', u2), 'operate')).toBe(false);
    expect(can(await person(u2), 'spaceUser', spaceRow('sr2', u2), 'operate')).toBe(true);
  });
});
