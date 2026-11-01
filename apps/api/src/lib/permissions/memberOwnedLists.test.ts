import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createProject,
  createSpace,
  createSpaceUser,
  createToken,
} from '@template/db/test';
import { app } from '#/app';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { createUserJwt } from '#tests/utils/createUserJwt';

type Headers = Record<string, string>;
type Row = { id: string; ownerModel: string };

const jwt = async (user: User): Promise<Headers> => ({
  authorization: (await createUserJwt(user)).authorization,
});

const list = async (headers: Headers, path: string) => {
  const response = await app.request(`/api/v1${path}`, { headers });
  if (response.status === 403) return 'denied' as const;
  if (!response.ok) return `unexpected ${response.status}` as const;
  return ((await response.json()) as { data: Row[] }).data;
};

let organization: Organization;
let space: Space;
let member: OrganizationUser;
let spaceMember: SpaceUser;
const callers: Record<string, Headers> = {};
const rows: Record<string, string> = {};

beforeAll(async () => {
  registerClearCacheHook();
  ({ entity: organization } = await createOrganization());
  ({ entity: space } = await createSpace({}, { organization }));

  const memberSeat = await createOrganizationUser({ role: 'member' }, { organization });
  member = memberSeat.entity;
  callers.member = await jwt(memberSeat.context.user);
  ({ entity: spaceMember } = await createSpaceUser(
    { role: 'member' },
    { ...memberSeat.context, space },
  ));

  for (const role of ['owner', 'admin', 'member'] as const) {
    const { context } = await createOrganizationUser({ role }, { organization });
    if (role !== 'member') await createSpaceUser({ role }, { ...context, space });
    callers[role === 'member' ? 'anotherMember' : `organization ${role}`] = await jwt(context.user);
  }
  callers.outsider = await jwt((await createOrganizationUser({ role: 'owner' })).context.user);

  const at = { organizationId: organization.id, role: 'viewer' as const };
  rows.memberIntegration = (
    await createIntegration({ ...at, ownerModel: 'OrganizationUser', userId: member.userId })
  ).entity.id;
  rows.spaceMemberIntegration = (
    await createIntegration({
      ...at,
      ownerModel: 'SpaceUser',
      spaceId: space.id,
      userId: spaceMember.userId,
    })
  ).entity.id;
  rows.organizationIntegration = (
    await createIntegration({ ...at, ownerModel: 'Organization' })
  ).entity.id;
  rows.memberProject = (
    await createProject({
      name: 'Mine',
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: member.userId,
    })
  ).entity.id;
  rows.spaceMemberProject = (
    await createProject({
      name: 'Mine in the space',
      ownerModel: 'SpaceUser',
      organizationId: organization.id,
      spaceId: space.id,
      userId: spaceMember.userId,
    })
  ).entity.id;
  rows.memberToken = (
    await createToken(
      { ownerModel: 'OrganizationUser' },
      { organizationUser: member, organization },
    )
  ).entity.id;
  rows.spaceMemberToken = (
    await createToken({ ownerModel: 'SpaceUser' }, { spaceUser: spaceMember, space, organization })
  ).entity.id;
  rows.organizationToken = (
    await createToken({ ownerModel: 'Organization' }, { organization })
  ).entity.id;
});

afterAll(async () => {
  unregisterDbHook('clearCache');
  await cleanupTouchedTables(db);
});

const whoCanList = async (path: string) =>
  Object.fromEntries(
    await Promise.all(
      Object.entries(callers).map(async ([name, headers]) => {
        const result = await list(headers, path);
        return [name, typeof result === 'string' ? result : 'lists'] as const;
      }),
    ),
  );

describe("a member's own rows are listed under the member, and only there", () => {
  for (const [label, path] of [
    ['organization member integrations', () => `/organizationUser/${member.id}/integrations`],
    ['organization member tokens', () => `/organizationUser/${member.id}/tokens`],
    ['space member integrations', () => `/spaceUser/${spaceMember.id}/integrations`],
    ['space member tokens', () => `/spaceUser/${spaceMember.id}/tokens`],
    ['organization member projects', () => `/organizationUser/${member.id}/projects`],
    ['space member projects', () => `/spaceUser/${spaceMember.id}/projects`],
  ] as const) {
    it(`${label}: the member and the organization's owner read them; an admin, another member and an outsider can't`, async () => {
      expect(await whoCanList(path())).toEqual({
        member: 'lists',
        'organization owner': 'lists',
        'organization admin': 'denied',
        anotherMember: 'denied',
        outsider: 'denied',
      });
    });
  }

  it("returns exactly that member's rows", async () => {
    const ids = async (path: string) =>
      ((await list(callers.member, path)) as Row[]).map((row) => row.id);
    expect(await ids(`/organizationUser/${member.id}/integrations`)).toEqual([
      rows.memberIntegration,
    ]);
    expect(await ids(`/organizationUser/${member.id}/tokens`)).toEqual([rows.memberToken]);
    expect(await ids(`/spaceUser/${spaceMember.id}/integrations`)).toEqual([
      rows.spaceMemberIntegration,
    ]);
    expect(await ids(`/spaceUser/${spaceMember.id}/tokens`)).toEqual([rows.spaceMemberToken]);
    expect(await ids(`/organizationUser/${member.id}/projects`)).toEqual([rows.memberProject]);
    expect(await ids(`/spaceUser/${spaceMember.id}/projects`)).toEqual([rows.spaceMemberProject]);
  });
});

describe("a tenant's list holds the tenant's own rows, never its members'", () => {
  it('the organization lists only organization-owned tokens and integrations', async () => {
    const owner = callers['organization owner'];
    const tokens = (await list(owner, `/organization/${organization.id}/tokens`)) as Row[];
    const integrations = (await list(
      owner,
      `/organization/${organization.id}/integrations`,
    )) as Row[];
    expect(tokens.map((row) => row.id)).toEqual([rows.organizationToken]);
    expect(integrations.map((row) => row.id)).toEqual([rows.organizationIntegration]);
  });

  it('the space lists no member-owned tokens', async () => {
    const tokens = (await list(
      callers['organization owner'],
      `/space/${space.id}/tokens`,
    )) as Row[];
    expect(tokens.every((row) => row.ownerModel === 'Space')).toBe(true);
  });

  it("/me lists every token that is the user's: their memberships' too, never the tenant's", async () => {
    const ids = ((await list(callers.member, '/me/tokens')) as Row[]).map((row) => row.id);
    expect(ids).toContain(rows.memberToken);
    expect(ids).toContain(rows.spaceMemberToken);
    expect(ids).not.toContain(rows.organizationToken);
  });
});

describe('an organization member connects an integration as themselves', () => {
  const create = (headers: Headers) =>
    app.request(`/api/v1/organizationUser/${member.id}/integrations`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Mine in the organization', provider: null, role: 'viewer' }),
    });

  it('the member creates it under their membership', async () => {
    const response = await create(callers.member);
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Row & { userId: string } };
    expect(data).toMatchObject({ ownerModel: 'OrganizationUser', userId: member.userId });
  });

  it('an organization admin and another member cannot create one for them', async () => {
    expect((await create(callers['organization admin'])).status).toBe(403);
    expect((await create(callers.anotherMember)).status).toBe(403);
  });
});

describe('a member mints tokens as themselves', () => {
  for (const [label, path] of [
    ['organization member', () => `/organizationUser/${member.id}/tokens`],
    ['space member', () => `/spaceUser/${spaceMember.id}/tokens`],
  ] as const) {
    it(`${label}: the member mints one; an admin, another member and an outsider can't`, async () => {
      const mint = async (headers: Headers) =>
        (
          await app.request(`/api/v1${path()}`, {
            method: 'POST',
            headers: { ...headers, 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'Mine', role: 'viewer' }),
          })
        ).status;
      expect(await mint(callers.member)).toBe(201);
      expect(await mint(callers['organization admin'])).toBe(403);
      expect(await mint(callers.anotherMember)).toBe(403);
      expect(await mint(callers.outsider)).toBe(403);
    });
  }
});

describe('a space member connects an integration as themselves', () => {
  const create = (headers: Headers) =>
    app.request(`/api/v1/spaceUser/${spaceMember.id}/integrations`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Mine in the space', provider: null, role: 'viewer' }),
    });

  it('the member creates it under their space membership', async () => {
    const response = await create(callers.member);
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Row & { spaceId: string; userId: string } };
    expect(data).toMatchObject({
      ownerModel: 'SpaceUser',
      spaceId: space.id,
      userId: spaceMember.userId,
    });
  });

  it('an organization admin and another member cannot create one for them', async () => {
    expect((await create(callers['organization admin'])).status).toBe(403);
    expect((await create(callers.anotherMember)).status).toBe(403);
  });
});
