import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, OrganizationUser, Role } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
} from '@template/db/test';
import { integrationRouter } from '#/modules/integration';
import { organizationUserRouter } from '#/modules/organizationUser';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { type Entry, entry } from '#tests/utils/entitlementEntry';
import { patch } from '#tests/utils/request';

let organization: Organization;

beforeAll(async () => {
  ({ entity: organization } = await createOrganization());
});

afterAll(async () => {
  await cleanupTouchedTables(db);
});

const writer = async (role: Role) => {
  const { entity: seat, context } = await createOrganizationUser({ role }, { organization });
  return createTestApp({
    mockUser: context.user,
    mockOrganizationUsers: [seat],
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

const stored = async (target: OrganizationUser) =>
  (await db.organizationUser.findUniqueOrThrow({ where: { id: target.id } })).entitlements;

const change = async (
  role: Role,
  target: OrganizationUser,
  body: { add?: Entry[]; remove?: Entry[] },
) => (await writer(role)).fetch(patch(`/api/v1/organizationUser/${target.id}/entitlements`, body));

describe("a member's entitlements change only through add and remove (R78)", () => {
  it("an admin cannot change an owner's entitlements, even with what it could grant; another owner can", async () => {
    const target = (await createOrganizationUser({ role: 'owner' }, { organization })).entity;
    const response = await change('admin', target, { add: [ownIntegrations(['read'])] });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { message: string }).message).toBe('Access denied');
    expect((await change('owner', target, { add: [ownIntegrations(['read'])] })).status).toBe(200);
  });

  it('an owner adds one, and it is stored', async () => {
    const target = await member();
    expect((await change('owner', target, { add: [spaceIntegrations(['delete'])] })).status).toBe(
      200,
    );
    expect(await stored(target)).toEqual([spaceIntegrations(['delete'])]);
  });

  it('an admin cannot add what it could not grant', async () => {
    const target = await member();
    expect((await change('admin', target, { add: [spaceIntegrations(['manage'])] })).status).toBe(
      403,
    );
    expect(await stored(target)).toBeNull();
  });

  it('removing needs the ability to grant it: an admin cannot strip what only an owner gives', async () => {
    const target = await member([spaceIntegrations(['delete'])]);
    expect(
      (await change('admin', target, { remove: [spaceIntegrations(['delete'])] })).status,
    ).toBe(403);
    expect(
      (await change('owner', target, { remove: [spaceIntegrations(['delete'])] })).status,
    ).toBe(200);
    expect(await stored(target)).toEqual([]);
  });

  it('an admin adds and removes what it could grant, in one change', async () => {
    const target = await member([ownIntegrations(['read'])]);
    expect(
      (
        await change('admin', target, {
          add: [ownIntegrations(['manage'])],
          remove: [ownIntegrations(['read'])],
        })
      ).status,
    ).toBe(200);
    expect(await stored(target)).toEqual([ownIntegrations(['manage'])]);
  });

  it('a removal that matches nothing stored is skipped unchecked, even one the writer could not grant', async () => {
    const target = await member([ownIntegrations(['read'])]);
    expect(
      (await change('admin', target, { remove: [spaceIntegrations(['manage'])] })).status,
    ).toBe(200);
    expect(await stored(target)).toEqual([ownIntegrations(['read'])]);
  });

  it('a removal that matches nothing stored is filtered out', async () => {
    const target = await member([ownIntegrations(['read'])]);
    expect((await change('admin', target, { remove: [ownIntegrations(['manage'])] })).status).toBe(
      200,
    );
    expect(await stored(target)).toEqual([ownIntegrations(['read'])]);
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
      app.fetch(patch(`/api/v1/integration/${integration.id}/entitlements`, { add }));
    expect((await to([ownIntegrations(['manage'])])).status).toBe(200);
    expect((await to([spaceIntegrations(['manage'])])).status).toBe(403);
  });

  it("a member's token: its user adds and removes any entitlement; the member caps it (R91)", async () => {
    const { entity: seat, context } = await createOrganizationUser(
      { role: 'admin' },
      { organization },
    );
    const { entity: token } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: 'viewer' },
      { organizationUser: seat },
    );
    const app = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [seat],
      mount: [(hono) => hono.route('/api/v1/token', tokenRouter)],
    });
    const to = (body: { add?: Entry[]; remove?: Entry[] }) =>
      app.fetch(patch(`/api/v1/token/${token.id}/entitlements`, body));
    expect((await to({ add: [ownIntegrations(['manage'])] })).status).toBe(200);
    expect((await to({ add: [spaceIntegrations(['manage'])] })).status).toBe(200);
    expect((await to({ remove: [ownIntegrations(['manage'])] })).status).toBe(200);
    expect((await db.token.findUniqueOrThrow({ where: { id: token.id } })).entitlements).toEqual([
      spaceIntegrations(['manage']),
    ]);
  });
});
