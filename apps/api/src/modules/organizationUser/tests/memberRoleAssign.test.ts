import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import type { Organization, Role, Space, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import { app } from '#/app';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { createUserJwt } from '#tests/utils/createUserJwt';

beforeAll(() => registerClearCacheHook());
afterAll(async () => {
  unregisterDbHook('clearCache');
  await cleanupTouchedTables(db);
});

const send = async (user: User, method: 'PATCH' | 'DELETE', path: string, body?: object) => {
  const { authorization } = await createUserJwt(user);
  const response = await app.request(path, {
    method,
    headers: { authorization, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.status;
};

describe('assigning an organization member a role needs manage and the role you set (Aron, 2026-10-26)', () => {
  let organization: Organization;

  const member = async (role: Role) => {
    const { entity, context } = await createOrganizationUser({ role }, { organization });
    return { row: entity, user: context.user };
  };

  const setRole = async (writer: Role, from: Role, to: Role) => {
    const { user } = await member(writer);
    const { row } = await member(from);
    return send(user, 'PATCH', `/api/v1/organizationUser/${row.id}`, { role: to });
  };

  const remove = async (writer: Role, target: Role) => {
    const { user } = await member(writer);
    const { row } = await member(target);
    return send(user, 'DELETE', `/api/v1/organizationUser/${row.id}`);
  };

  beforeAll(async () => {
    ({ entity: organization } = await createOrganization());
    await member('owner');
  });

  it('an owner assigns any role', async () => {
    expect(await setRole('owner', 'member', 'admin')).toBe(200);
    expect(await setRole('owner', 'member', 'owner')).toBe(200);
    expect(await setRole('owner', 'admin', 'viewer')).toBe(200);
  });

  it('an admin sets roles it holds: admin and below, never to or from owner', async () => {
    expect(await setRole('admin', 'member', 'viewer')).toBe(200);
    expect(await setRole('admin', 'viewer', 'member')).toBe(200);
    expect(await setRole('admin', 'member', 'admin')).toBe(200);
    expect(await setRole('admin', 'admin', 'member')).toBe(200);
    expect(await setRole('admin', 'member', 'owner')).toBe(403);
    expect(await setRole('admin', 'owner', 'viewer')).toBe(403);
  });

  it('a member or viewer assigns nothing', async () => {
    expect(await setRole('member', 'viewer', 'member')).toBe(403);
    expect(await setRole('viewer', 'viewer', 'viewer')).toBe(403);
  });

  it('removing a member needs the role it has, or leaving', async () => {
    expect(await remove('owner', 'admin')).toBe(204);
    expect(await remove('admin', 'member')).toBe(204);
    expect(await remove('admin', 'admin')).toBe(204);
    expect(await remove('admin', 'owner')).toBe(403);
    expect(await remove('member', 'viewer')).toBe(403);

    const { row, user } = await member('viewer');
    expect(await send(user, 'DELETE', `/api/v1/organizationUser/${row.id}`)).toBe(204);
  });

  it("another organization's owner assigns nothing here", async () => {
    const { context } = await createOrganizationUser({ role: 'owner' });
    const { row } = await member('member');
    expect(
      await send(context.user, 'PATCH', `/api/v1/organizationUser/${row.id}`, { role: 'viewer' }),
    ).toBe(403);
    expect(await send(context.user, 'DELETE', `/api/v1/organizationUser/${row.id}`)).toBe(403);
  });

  it('a user with no seat anywhere assigns nothing', async () => {
    const { entity: stranger } = await createUser();
    const { row } = await member('member');
    expect(
      await send(stranger, 'PATCH', `/api/v1/organizationUser/${row.id}`, { role: 'viewer' }),
    ).toBe(403);
  });
});

describe('assigning a space member a role needs manage and the role you set (Aron, 2026-10-26)', () => {
  let organization: Organization;
  let space: Space;

  const spaceMember = async (role: Role) => {
    const { context } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity } = await createSpaceUser({ role }, { ...context, space });
    return { row: entity, user: context.user };
  };

  const orgMember = async (role: Role) =>
    (await createOrganizationUser({ role }, { organization })).context.user;

  const setRole = async (writer: User, from: Role, to: Role) => {
    const { row } = await spaceMember(from);
    return send(writer, 'PATCH', `/api/v1/spaceUser/${row.id}`, { role: to });
  };

  const remove = async (writer: User, target: Role) => {
    const { row } = await spaceMember(target);
    return send(writer, 'DELETE', `/api/v1/spaceUser/${row.id}`);
  };

  beforeAll(async () => {
    ({ entity: organization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
  });

  it('a space owner assigns any role', async () => {
    const { user } = await spaceMember('owner');
    expect(await setRole(user, 'member', 'admin')).toBe(200);
    expect(await setRole(user, 'admin', 'viewer')).toBe(200);
    expect(await remove(user, 'admin')).toBe(204);
  });

  it('a space admin sets roles it holds: admin and below, never owner', async () => {
    const { user } = await spaceMember('admin');
    expect(await setRole(user, 'member', 'viewer')).toBe(200);
    expect(await setRole(user, 'member', 'admin')).toBe(200);
    expect(await setRole(user, 'admin', 'member')).toBe(200);
    expect(await setRole(user, 'member', 'owner')).toBe(403);
    expect(await remove(user, 'member')).toBe(204);
    expect(await remove(user, 'admin')).toBe(204);
    expect(await remove(user, 'owner')).toBe(403);
  });

  it('a space member assigns nothing, but leaves', async () => {
    const { user, row } = await spaceMember('member');
    expect(await setRole(user, 'viewer', 'member')).toBe(403);
    expect(await remove(user, 'viewer')).toBe(403);
    expect(await send(user, 'DELETE', `/api/v1/spaceUser/${row.id}`)).toBe(204);
  });

  it('an organization owner with no space seat assigns any role (space own is org own)', async () => {
    const owner = await orgMember('owner');
    expect(await setRole(owner, 'member', 'admin')).toBe(200);
    expect(await remove(owner, 'admin')).toBe(204);
  });

  it('an organization admin with no space seat assigns nothing in the space', async () => {
    const admin = await orgMember('admin');
    expect(await setRole(admin, 'member', 'viewer')).toBe(403);
    expect(await remove(admin, 'viewer')).toBe(403);
  });
});
