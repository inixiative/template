import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Role,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
} from '@template/db/test';
import { registerFullDelegateHook } from '#/hooks/fullDelegate/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { patch } from '#tests/utils/request';

let organization: Organization;

const hooks = [
  'fullDelegate',
  'fullDelegate:upsert',
  'rules:create',
  'rules:upsert',
  'rules:update',
  'rules:updateManyAndReturn',
];

beforeAll(async () => {
  for (const name of hooks) unregisterDbHook(name);
  registerFullDelegateHook();
  registerRulesHook();
  ({ entity: organization } = await createOrganization());
});

afterAll(async () => {
  for (const name of hooks) unregisterDbHook(name);
  await cleanupTouchedTables(db);
});

const memberOf = async (role: Role) => {
  const { entity: member, context } = await createOrganizationUser({ role }, { organization });
  return { member, user: context.user };
};

const tokenOf = async (member: OrganizationUser, data: { role: Role | null; full?: boolean }) =>
  createKeyedToken({ ownerModel: 'OrganizationUser', ...data }, { organizationUser: member });

const as = (user: User, member: OrganizationUser) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: [member],
    mount: [(hono) => hono.route('/api/v1/token', tokenRouter)],
  });

const update = (app: ReturnType<typeof as>, id: string, body: Record<string, unknown>) =>
  app.fetch(patch(`/api/v1/token/${id}`, body));

describe('PATCH /token/:id — a token is full or narrowed, and either can change', () => {
  it('its user changes the role, and names it', async () => {
    const { member, user } = await memberOf('admin');
    const { entity: token } = await tokenOf(member, { role: 'admin' });
    expect(
      (await update(as(user, member), token.id, { role: 'viewer', name: 'reader' })).status,
    ).toBe(200);
    expect(await db.token.findUniqueOrThrow({ where: { id: token.id } })).toMatchObject({
      role: 'viewer',
      name: 'reader',
    });
  });

  it("an admin raises its own token to owner: it holds the member's role or less (Aron, 2026-10-29)", async () => {
    const { member, user } = await memberOf('admin');
    const { entity: token } = await tokenOf(member, { role: 'viewer' });
    expect((await update(as(user, member), token.id, { role: 'owner' })).status).toBe(200);
  });

  it("a viewer raises its own token above viewer: it holds the member's role or less (Aron, 2026-10-29)", async () => {
    const { member, user } = await memberOf('viewer');
    const { entity: token } = await tokenOf(member, { role: 'viewer' });
    expect((await update(as(user, member), token.id, { role: 'member' })).status).toBe(200);
  });

  it('another user cannot change my token', async () => {
    const { member } = await memberOf('owner');
    const { entity: token } = await tokenOf(member, { role: 'viewer' });
    const other = await memberOf('owner');
    expect((await update(as(other.user, other.member), token.id, { role: 'admin' })).status).toBe(
      403,
    );
  });

  it('a token cannot change itself', async () => {
    const { member } = await memberOf('owner');
    const { entity: token, rawKey } = await tokenOf(member, { role: 'admin' });
    const { call } = createTokenProbeApp((hono) => hono.route('/api/v1/token', tokenRouter));
    expect(
      (await call(rawKey, 'PATCH', `/api/v1/token/${token.id}`, { role: 'owner' })).status,
    ).toBe(403);
  });

  it('its user narrows a full token, then makes it full again', async () => {
    const { member, user } = await memberOf('owner');
    const { entity: token } = await tokenOf(member, { role: null, full: true });
    const app = as(user, member);
    expect((await update(app, token.id, { full: false, role: 'viewer' })).status).toBe(200);
    expect((await update(app, token.id, { full: true })).status).toBe(200);
    expect(await db.token.findUniqueOrThrow({ where: { id: token.id } })).toMatchObject({
      full: true,
      role: null,
    });
  });

  it("an admin cannot make the organization integration's token full: full needs delegateFull on the integration, which only the organization's owner holds", async () => {
    const { entity: integration } = await createIntegration({
      organizationId: organization.id,
      ownerModel: 'Organization',
      role: 'viewer',
    });
    const tokenOfIntegration = async () =>
      (await createKeyedToken({ ownerModel: 'Integration', role: 'viewer' }, { integration }))
        .entity;
    const full = { full: true, role: null };
    const admin = await memberOf('admin');
    expect(
      (await update(as(admin.user, admin.member), (await tokenOfIntegration()).id, full)).status,
    ).toBe(403);
    const owner = await memberOf('owner');
    expect(
      (await update(as(owner.user, owner.member), (await tokenOfIntegration()).id, full)).status,
    ).toBe(200);
  });
});
