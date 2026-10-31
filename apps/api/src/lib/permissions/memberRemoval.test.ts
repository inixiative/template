import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Role,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
} from '@template/db/test';
import { app } from '#/app';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createUserJwt } from '#tests/utils/createUserJwt';

beforeAll(() => registerClearCacheHook());
afterAll(async () => {
  unregisterDbHook('clearCache');
  await cleanupTouchedTables(db);
});

type Headers = Record<string, string>;

const jwt = async (user: User): Promise<Headers> => ({
  authorization: (await createUserJwt(user)).authorization,
});
const bearer = (rawKey: string): Headers => ({ authorization: `Bearer ${rawKey}` });

const remove = async (headers: Headers, path: string) =>
  (await app.request(`/api/v1${path}`, { method: 'DELETE', headers })).status;

describe('removing an organization member, through the route', () => {
  let organization: Organization;
  const member = async (role: Role) => {
    const { entity, context } = await createOrganizationUser({ role }, { organization });
    return { row: entity as OrganizationUser, user: context.user as User };
  };
  const path = (row: OrganizationUser) => `/organizationUser/${row.id}`;

  beforeAll(async () => {
    ({ entity: organization } = await createOrganization());
    await member('owner');
  });

  it('a user leaves their own membership', async () => {
    const { row, user } = await member('member');
    expect(await remove(await jwt(user), path(row))).toBe(204);
  });

  it('a member cannot remove another member', async () => {
    const { user } = await member('member');
    const { row } = await member('member');
    expect(await remove(await jwt(user), path(row))).toBe(403);
  });

  it('an admin evicts a member, not an owner', async () => {
    const { user } = await member('admin');
    const { row: memberRow } = await member('member');
    const { row: ownerRow } = await member('owner');
    expect(await remove(await jwt(user), path(memberRow))).toBe(204);
    expect(await remove(await jwt(user), path(ownerRow))).toBe(403);
  });

  it('an owner evicts an admin', async () => {
    const { user } = await member('owner');
    const { row } = await member('admin');
    expect(await remove(await jwt(user), path(row))).toBe(204);
  });

  it("a member's own token cannot leave its member row", async () => {
    const { row } = await member('member');
    const { rawKey } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: 'member' },
      { organizationUser: row },
    );
    expect(await remove(bearer(rawKey), path(row))).toBe(403);
  });

  it("an owner's member token removes members through the owner's authority, its own row included", async () => {
    const { row } = await member('owner');
    const { row: memberRow } = await member('member');
    const { rawKey } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: 'owner' },
      { organizationUser: row },
    );
    expect(await remove(bearer(rawKey), path(memberRow))).toBe(204);
    expect(await remove(bearer(rawKey), path(row))).toBe(204);
  });

  it("a user's token leaves for its user when it holds manage on the user, not operate: leaving reaches another tenancy (Aron, 2026-10-31)", async () => {
    const { row, user } = await member('member');
    const operator = await createKeyedToken({ ownerModel: 'User', role: 'member' }, { user });
    expect(await remove(bearer(operator.rawKey), path(row))).toBe(403);
    const manager = await createKeyedToken({ ownerModel: 'User', role: 'admin' }, { user });
    expect(await remove(bearer(manager.rawKey), path(row))).toBe(204);
  });
});

describe('removing a space member, through the route', () => {
  let organization: Organization;
  let space: Space;
  const member = async (role: Role) => {
    const { entity, context } = await createSpaceUser({ role }, { organization, space });
    return { row: entity as SpaceUser, user: context.user as User };
  };
  const path = (row: SpaceUser) => `/spaceUser/${row.id}`;

  beforeAll(async () => {
    ({ entity: organization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
  });

  it('a user leaves their own space membership', async () => {
    const { row, user } = await member('member');
    expect(await remove(await jwt(user), path(row))).toBe(204);
  });

  it('a space member cannot remove another', async () => {
    const { user } = await member('member');
    const { row } = await member('member');
    expect(await remove(await jwt(user), path(row))).toBe(403);
  });

  it('a space admin evicts a member, not an owner', async () => {
    const { user } = await member('admin');
    const { row: memberRow } = await member('member');
    const { row: ownerRow } = await member('owner');
    expect(await remove(await jwt(user), path(memberRow))).toBe(204);
    expect(await remove(await jwt(user), path(ownerRow))).toBe(403);
  });
});
