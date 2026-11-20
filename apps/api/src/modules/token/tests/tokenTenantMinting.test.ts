import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Project,
  Role,
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
  createUser,
} from '@template/db/test';
import { app } from '#/app';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { createUserJwt } from '#tests/utils/createUserJwt';
import { entitlementInputFor } from '#tests/utils/entitlementInputFor';

type Headers = Record<string, string>;
type Person = { user: User; row?: OrganizationUser; spaceRow?: SpaceUser };

const jwt = async (user: User): Promise<Headers> => ({
  authorization: (await createUserJwt(user)).authorization,
});
const bearer = (key: string): Headers => ({ authorization: `Bearer ${key}` });

const send = async (headers: Headers, method: string, path: string, body?: unknown) => {
  const response = await app.request(`/api/v1${path}`, {
    method,
    headers: { ...headers, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, json };
};

const mint = async (headers: Headers, path: string, body: Record<string, unknown>) => {
  const { status, json } = await send(headers, 'POST', path, { name: 'probe', ...body });
  const data = (json as { data?: { key?: string; id?: string } } | null)?.data;
  return { status, key: data?.key, id: data?.id, json };
};

const tokenRoles: (Role | null)[] = [null, 'viewer', 'member', 'admin', 'owner'];

const mintMatrix = async (headers: Headers, path: string) => {
  const result: Record<string, number> = {};
  for (const role of tokenRoles)
    result[String(role)] = (await mint(headers, path, { role })).status;
  return result;
};

const allowedUpTo = (highest: Role | null) => {
  const order = ['null', 'viewer', 'member', 'admin', 'owner'];
  const top = highest === null ? -1 : order.indexOf(highest);
  return Object.fromEntries(order.map((role, index) => [role, index <= top ? 201 : 403]));
};

let organization: Organization;
let space: Space;
let otherSpace: Space;
let people: Record<'owner' | 'admin' | 'member' | 'viewer', Person>;
let outsider: User;

beforeEach(async () => {
  ({ entity: organization } = await createOrganization());
  ({ entity: space } = await createSpace({}, { organization }));
  ({ entity: otherSpace } = await createSpace({}, { organization }));
  const member = async (role: Role): Promise<Person> => {
    const { entity, context } = await createOrganizationUser({ role }, { organization });
    return { user: context.user as User, row: entity };
  };
  people = {
    owner: await member('owner'),
    admin: await member('admin'),
    member: await member('member'),
    viewer: await member('viewer'),
  };
  ({ entity: outsider } = await createUser());
});

afterEach(async () => {
  await cleanupTouchedTables(db);
});

const organizationIntegration = async () =>
  (
    await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      role: 'admin',
    })
  ).entity;

describe('minting a token owned by a tenant or by its integration takes manage on the tenant', () => {
  it('an Organization token: admins and owners, capped at their own role', async () => {
    const path = `/organization/${organization.id}/tokens`;
    const refused = allowedUpTo(null);
    expect(await mintMatrix(await jwt(people.viewer.user), path)).toEqual(refused);
    expect(await mintMatrix(await jwt(people.member.user), path)).toEqual(refused);
    expect(await mintMatrix(await jwt(outsider), path)).toEqual(refused);
    expect(await mintMatrix(await jwt(people.admin.user), path)).toEqual(allowedUpTo('admin'));
    expect(await mintMatrix(await jwt(people.owner.user), path)).toEqual(allowedUpTo('owner'));
  });

  it('a Space token: a space member is refused, a space admin mints up to admin', async () => {
    const spaceMember = async (role: Role) => {
      const { entity: row, context } = await createOrganizationUser(
        { role: 'viewer' },
        { organization },
      );
      await createSpaceUser(
        { role },
        { organization, organizationUser: row, user: context.user, space },
      );
      return jwt(context.user as User);
    };
    const path = `/space/${space.id}/tokens`;
    expect(await mintMatrix(await spaceMember('member'), path)).toEqual(allowedUpTo(null));
    expect(await mintMatrix(await spaceMember('admin'), path)).toEqual(allowedUpTo('admin'));
  });

  it('a token under an Organization integration: the same gate', async () => {
    const path = `/integration/${(await organizationIntegration()).id}/tokens`;
    expect(await mintMatrix(await jwt(people.viewer.user), path)).toEqual(allowedUpTo(null));
    expect(await mintMatrix(await jwt(people.member.user), path)).toEqual(allowedUpTo(null));
    expect(await mintMatrix(await jwt(people.admin.user), path)).toEqual(allowedUpTo('admin'));
  });

  it('a member still mints on their own member row and their own user', async () => {
    const viewer = await jwt(people.viewer.user);
    const rowPath = `/organizationUser/${people.viewer.row!.id}/tokens`;
    expect((await mint(viewer, rowPath, { role: 'viewer' })).status).toBe(201);
    expect((await mint(viewer, '/me/tokens', { role: 'viewer' })).status).toBe(201);
  });

  it('a member holding an entitlement cannot put it on an Organization token', async () => {
    const project: Project = (
      await createProject({
        ownerModel: 'Space',
        organizationId: organization.id,
        spaceId: otherSpace.id,
      })
    ).entity;
    const entry = entitlementInputFor('db:project', ['db:project', project.id], ['manage']);
    const owner = await jwt(people.owner.user);
    const rowPath = `/organizationUser/${people.viewer.row!.id}`;
    expect((await send(owner, 'POST', `${rowPath}/entitlements`, [entry])).status).toBe(201);
    const viewer = await jwt(people.viewer.user);
    const organizationToken = await mint(viewer, `/organization/${organization.id}/tokens`, {
      role: null,
      entitlements: [entry],
    });
    expect(organizationToken.status).toBe(403);
    expect(
      (await mint(viewer, `${rowPath}/tokens`, { role: null, entitlements: [entry] })).status,
    ).toBe(201);
  });

  it('a member cannot change a tenant token; an admin can', async () => {
    const admin = await jwt(people.admin.user);
    const member = await jwt(people.member.user);
    const token = await mint(admin, `/organization/${organization.id}/tokens`, { role: null });
    const path = `/token/${token.id}`;
    expect((await send(member, 'PATCH', path, { role: 'member' })).status).toBe(403);
    expect((await send(member, 'PATCH', path, { name: 'renamed' })).status).toBe(403);
    expect((await send(member, 'DELETE', path)).status).toBe(403);
    expect((await send(admin, 'PATCH', path, { role: 'member' })).status).toBe(200);
    expect((await send(admin, 'DELETE', path)).status).toBe(204);
  });

  it("an admin's Organization token keeps working after the admin is removed", async () => {
    const admin = await jwt(people.admin.user);
    const token = await mint(admin, `/organization/${organization.id}/tokens`, { role: 'admin' });
    const owner = await jwt(people.owner.user);
    expect((await send(owner, 'DELETE', `/organizationUser/${people.admin.row!.id}`)).status).toBe(
      204,
    );
    const rename = (headers: Headers) =>
      send(headers, 'PATCH', `/organization/${organization.id}`, { name: 'renamed' });
    expect((await rename(admin)).status).toBe(403);
    expect((await rename(bearer(token.key!))).status).toBe(200);
  });

  it('an entitlement an admin puts on an Organization token stays after the admin loses theirs', async () => {
    const project: Project = (
      await createProject({
        ownerModel: 'Space',
        organizationId: organization.id,
        spaceId: otherSpace.id,
      })
    ).entity;
    const entry = entitlementInputFor('db:project', ['db:project', project.id], ['manage']);
    const owner = await jwt(people.owner.user);
    const admin = await jwt(people.admin.user);
    const rowPath = `/organizationUser/${people.admin.row!.id}`;
    const rename = (headers: Headers) =>
      send(headers, 'PATCH', `/project/${project.id}`, { name: 'renamed' });
    expect((await rename(admin)).status).toBe(403);
    expect((await send(owner, 'POST', `${rowPath}/entitlements`, [entry])).status).toBe(201);
    const token = await mint(admin, `/organization/${organization.id}/tokens`, {
      role: null,
      entitlements: [entry],
    });
    expect(token.status).toBe(201);
    const held = await db.entitlement.findMany({
      where: {
        targetModel: 'OrganizationUser',
        targetId: people.admin.row!.id,
        resource: 'Project',
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(
      (
        await send(
          owner,
          'DELETE',
          `${rowPath}/entitlements`,
          held.map(({ id }) => id),
        )
      ).status,
    ).toBe(204);
    expect((await rename(admin)).status).toBe(403);
    expect((await rename(bearer(token.key!))).status).toBe(200);
  });
});
