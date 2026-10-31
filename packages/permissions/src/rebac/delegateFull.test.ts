import { describe, expect, it } from 'bun:test';
import type { HydratedRecord } from '@template/db';
import { ActorModel, createPermissions, type PermissionEntry } from '@template/permissions/client';
import { check } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';

const o1 = { id: 'o1' };
const s1 = { id: 's1', organizationId: o1.id, organization: o1 };
const u1 = { id: 'u1' };
const u2 = { id: 'u2' };
const m1 = {
  id: 'm1',
  role: 'member',
  userId: u1.id,
  organizationId: o1.id,
  user: u1,
  organization: o1,
};
const sm1 = {
  id: 'sm1',
  role: 'member',
  userId: u1.id,
  organizationId: o1.id,
  spaceId: s1.id,
  user: u1,
  space: s1,
};

const integrationOf = (ownerModel: string, owner: Record<string, unknown>) => ({
  id: `i-${ownerModel}`,
  ownerModel,
  role: 'owner',
  organizationId: o1.id,
  organization: o1,
  ...owner,
});
const i = {
  Organization: integrationOf('Organization', {}),
  Space: integrationOf('Space', { spaceId: s1.id, space: s1 }),
  OrganizationUser: integrationOf('OrganizationUser', { userId: u1.id, organizationUser: m1 }),
  User: integrationOf('User', {
    organizationId: null,
    organization: null,
    userId: u1.id,
    user: u1,
  }),
};

const grant = (resource: string, id: string, action: string): PermissionEntry => ({
  resource,
  id,
  actions: { [action]: true },
});
const tableOf = async (actor: ActorModel, user: { id: string }, ...entries: PermissionEntry[]) => {
  const permix = createPermissions();
  await permix.setup([grant('db:user', user.id, 'own'), ...entries]);
  permix.setActor({ model: actor, record: { id: actor === ActorModel.User ? user.id : 't1' } });
  return permix;
};
const person = (user: { id: string }, ...entries: PermissionEntry[]) =>
  tableOf(ActorModel.User, user, ...entries);
const token = (user: { id: string }, ...entries: PermissionEntry[]) =>
  tableOf(ActorModel.Token, user, ...entries);
const holds = (
  permix: Awaited<ReturnType<typeof tableOf>>,
  model: Parameters<typeof check>[2],
  record: object,
) => check(permix, rebacSchema, model, record as HydratedRecord, 'delegateFull');

describe('delegateFull: who may make a delegate of this thing full (Aron, 2026-10-30)', () => {
  const owner = () => person(u2, grant('db:organization', o1.id, 'own'));
  const admin = () => person(u2, grant('db:organization', o1.id, 'manage'));

  it('a member: its user, not the organization owner or an admin', async () => {
    expect(
      holds(await person(u1, grant('db:organization', o1.id, 'operate')), 'organizationUser', m1),
    ).toBe(true);
    expect(holds(await owner(), 'organizationUser', m1)).toBe(false);
    expect(holds(await admin(), 'organizationUser', m1)).toBe(false);
  });

  it('a space member: its user, not the organization owner', async () => {
    expect(holds(await person(u1), 'spaceUser', sm1)).toBe(true);
    expect(holds(await owner(), 'spaceUser', sm1)).toBe(false);
  });

  it("the organization's or a space's integration: the owner, not an admin", async () => {
    for (const integration of [i.Organization, i.Space]) {
      expect(holds(await owner(), 'integration', integration)).toBe(true);
      expect(holds(await admin(), 'integration', integration)).toBe(false);
    }
  });

  it("a member's integration: the member's user, not the organization owner", async () => {
    expect(holds(await person(u1), 'integration', i.OrganizationUser)).toBe(true);
    expect(holds(await owner(), 'integration', i.OrganizationUser)).toBe(false);
  });

  it("a user's integration and the user: that user only", async () => {
    expect(holds(await person(u1), 'integration', i.User)).toBe(true);
    expect(holds(await person(u2), 'integration', i.User)).toBe(false);
    expect(holds(await person(u1), 'user', u1)).toBe(true);
    expect(holds(await person(u2), 'user', u1)).toBe(false);
  });

  it('an organization or a space: nobody, not even its owner', async () => {
    expect(holds(await owner(), 'organization', o1)).toBe(false);
    expect(holds(await owner(), 'space', s1)).toBe(false);
  });

  it('a token never holds it, even holding everything its user holds (Aron, 2026-10-30)', async () => {
    const full = await token(u1, grant('db:organization', o1.id, 'own'));
    expect(holds(full, 'organizationUser', m1)).toBe(false);
    expect(holds(full, 'integration', i.OrganizationUser)).toBe(false);
    expect(holds(full, 'integration', i.Organization)).toBe(false);
    expect(holds(full, 'user', u1)).toBe(false);
  });
});
