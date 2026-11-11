import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, OrganizationUser, Role } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
} from '@template/db/test';
import { isMemberSelfGrant } from '@template/permissions';
import { integrationRouter } from '#/modules/integration';
import { organizationUserRouter } from '#/modules/organizationUser';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { type Entry, entry } from '#tests/utils/entitlementEntry';
import {
  changeEntitlements,
  heldEntitlements,
  revokeEntitlements,
} from '#tests/utils/entitlements';
import { patch } from '#tests/utils/request';

let organization: Organization;

beforeEach(async () => {
  ({ entity: organization } = await createOrganization());
});

afterEach(async () => {
  await cleanupTouchedTables(db);
});

const writer = async (role: Role) => {
  const { entity: organizationUser, context } = await createOrganizationUser(
    { role },
    { organization },
  );
  return createTestApp({
    mockUser: context.user,
    mockOrganizationUsers: [organizationUser],
    mount: [
      (hono) => {
        hono.route('/api/v1/organizationUser', organizationUserRouter);
        hono.route('/api/v1/integration', integrationRouter);
        hono.route('/api/v1/token', tokenRouter);
      },
    ],
  });
};

const ownIntegrations = (actions: string[]) => ({
  ...entry('db:integration', ['db:organization', organization.id, 'organization'], actions),
  where: { field: 'ownerModel', operator: 'equals', value: 'Organization' },
});
const spaceIntegrations = (actions: string[]) =>
  entry('db:integration', ['db:organization', organization.id, 'space.organization'], actions);

const member = async (entitlements?: Entry[]) =>
  (await createOrganizationUser({ role: 'member', entitlements }, { organization })).entity;

const onMember = (target: OrganizationUser) => ({
  model: 'OrganizationUser' as const,
  id: target.id,
});

const stored = async (target: OrganizationUser): Promise<unknown> =>
  (await heldEntitlements(onMember(target))).filter(
    (entry) => !isMemberSelfGrant('db:organizationUser', target)(entry),
  );

const change = async (
  role: Role,
  target: OrganizationUser,
  body: { add?: Entry[]; remove?: Entry[] },
) => changeEntitlements(await writer(role), onMember(target), body);

describe("a member's entitlements change only through its entitlement rows: create-many and delete-many (Aron, 2026-11-02)", () => {
  it("an admin cannot change an owner's entitlements, even with what it could grant; another owner can", async () => {
    const target = (await createOrganizationUser({ role: 'owner' }, { organization })).entity;
    const response = await change('admin', target, { add: [ownIntegrations(['read'])] });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { message: string }).message).toBe('Access denied');
    expect((await change('owner', target, { add: [ownIntegrations(['read'])] })).status).toBe(201);
  });

  it('an owner adds one, and it is stored', async () => {
    const target = await member();
    expect((await change('owner', target, { add: [spaceIntegrations(['delete'])] })).status).toBe(
      201,
    );
    expect(await stored(target)).toEqual([spaceIntegrations(['delete'])]);
  });

  it('an admin cannot add what it could not grant', async () => {
    const target = await member();
    expect((await change('admin', target, { add: [spaceIntegrations(['manage'])] })).status).toBe(
      403,
    );
    expect(await stored(target)).toEqual([]);
  });

  it('removing needs the ability to grant it: an admin cannot strip what only an owner gives', async () => {
    const target = await member([spaceIntegrations(['delete'])]);
    expect(
      (await change('admin', target, { remove: [spaceIntegrations(['delete'])] })).status,
    ).toBe(403);
    expect(
      (await change('owner', target, { remove: [spaceIntegrations(['delete'])] })).status,
    ).toBe(204);
    expect(await stored(target)).toEqual([]);
  });

  it('an admin removes one row and grants another it could grant, in a delete-many then a create-many', async () => {
    const target = await member([ownIntegrations(['read'])]);
    expect(
      (
        await change('admin', target, {
          add: [ownIntegrations(['manage'])],
          remove: [ownIntegrations(['read'])],
        })
      ).status,
    ).toBe(201);
    expect(await stored(target)).toEqual([ownIntegrations(['manage'])]);
  });

  it('a removal names rows of this holder: an id it does not hold is a 404, and nothing goes', async () => {
    const target = await member([ownIntegrations(['read'])]);
    const other = await member([ownIntegrations(['read'])]);
    const [othersRow] = await db.entitlement.findMany({
      where: { targetModel: 'OrganizationUser', targetId: other.id, actions: { has: 'read' } },
    });
    const app = await writer('owner');
    expect((await revokeEntitlements(app, onMember(target), [othersRow!.id])).status).toBe(404);
    expect(await stored(target)).toEqual([ownIntegrations(['read'])]);
    expect(await stored(other)).toEqual([ownIntegrations(['read'])]);
  });

  it('an entry already covered by one held is not stored twice', async () => {
    const target = await member([ownIntegrations(['read'])]);
    expect((await change('owner', target, { add: [ownIntegrations(['read'])] })).status).toBe(201);
    expect(await stored(target)).toEqual([ownIntegrations(['read'])]);
  });

  it('each entry of a create-many body carries a positive where, checked before the grant', async () => {
    const target = await member();
    const negated = {
      ...ownIntegrations(['read']),
      where: { field: 'name', operator: 'isEmpty', value: true },
    };
    const response = await change('owner', target, { add: [negated] });
    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).toContain('isEmpty can hold on a missing value');
    expect(await stored(target)).toEqual([]);
  });

  it('a malformed entry is refused before anything is saved', async () => {
    const target = await member();
    const pathless = entry('db:integration', ['db:organization', organization.id], ['read']);
    expect((await change('owner', target, { add: [pathless] })).status).toBe(422);
  });

  it('updating the member row cannot carry entitlements: the body is refused', async () => {
    const target = await member([ownIntegrations(['read'])]);
    const response = await (await writer('owner')).fetch(
      patch(`/api/v1/organizationUser/${target.id}`, {
        role: 'viewer',
        entitlements: [spaceIntegrations(['manage'])],
      }),
    );
    expect(response.status).toBe(422);
    expect(await stored(target)).toEqual([ownIntegrations(['read'])]);
  });
});

describe('integrations and tokens change their entitlements the same way', () => {
  it('an integration of the organization: an admin adds what it could grant, not more', async () => {
    const { entity: integration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      role: 'viewer',
    });
    const app = await writer('admin');
    const to = (add: Entry[]) =>
      changeEntitlements(app, { model: 'Integration', id: integration.id }, { add });
    expect((await to([ownIntegrations(['manage'])])).status).toBe(201);
    expect((await to([spaceIntegrations(['manage'])])).status).toBe(403);
  });

  it("a member's token: its user adds and removes only what they hold (Aron, 2026-10-31)", async () => {
    const { entity: organizationUser, context } = await createOrganizationUser(
      { role: 'admin' },
      { organization },
    );
    const { entity: token } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: 'viewer' },
      { organizationUser: organizationUser },
    );
    const app = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [organizationUser],
      mount: [(hono) => hono.route('/api/v1/token', tokenRouter)],
    });
    const onToken = { model: 'Token' as const, id: token.id };
    const to = (body: { add?: Entry[]; remove?: Entry[] }) =>
      changeEntitlements(app, onToken, body);
    expect((await to({ add: [ownIntegrations(['manage'])] })).status).toBe(201);
    expect((await to({ add: [spaceIntegrations(['manage'])] })).status).toBe(403);
    expect((await to({ remove: [ownIntegrations(['manage'])] })).status).toBe(204);
    expect(await heldEntitlements(onToken)).toEqual([]);
  });
});
