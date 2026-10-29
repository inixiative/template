import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, Role, Space, SpaceUser } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
} from '@template/db/test';
import { spaceUserRouter } from '#/modules/spaceUser';
import { createTestApp } from '#tests/createTestApp';
import { entry } from '#tests/utils/entitlementEntry';
import { json, patch } from '#tests/utils/request';

describe('PATCH /api/v1/spaceUser/:id', () => {
  let org: Organization;
  let space: Space;

  beforeAll(async () => {
    ({ entity: org } = await createOrganizationUser({ role: 'owner' }).then(({ context }) => ({
      entity: context.organization,
    })));
    ({ entity: space } = await createSpace({}, { organization: org }));
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const spaceMember = async (role: Role) => {
    const { context } = await createOrganizationUser({ role: 'member' }, { organization: org });
    return createSpaceUser({ role }, { ...context, space });
  };

  const writer = async (role: Role) => {
    const { entity, context } = await spaceMember(role);
    return createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [context.organizationUser],
      mockSpaceUsers: [entity],
      mount: [(app) => app.route('/api/v1/spaceUser', spaceUserRouter)],
    }).fetch;
  };

  const onSpace = (...actions: string[]) => [entry('db:space', ['db:space', space.id], actions)];

  const write = async (by: Role, target: SpaceUser, body: object) =>
    (await writer(by))(patch(`/api/v1/spaceUser/${target.id}`, body));
  const grantTo = async (by: Role, target: SpaceUser, add: unknown) =>
    (await writer(by))(patch(`/api/v1/spaceUser/${target.id}/entitlements`, { add }));

  it('updates the role', async () => {
    const { entity: target } = await spaceMember('member');
    const response = await write('owner', target, { role: 'viewer' });
    expect(response.status).toBe(200);
    expect((await json<SpaceUser>(response)).data.role).toBe('viewer');
  });

  it("a space admin grants a space member's entitlements it could take itself", async () => {
    const { entity: target } = await spaceMember('member');
    expect((await grantTo('admin', target, onSpace('operate'))).status).toBe(200);
    const stored = await db.spaceUser.findUniqueOrThrow({ where: { id: target.id } });
    expect(stored.entitlements).toEqual(onSpace('operate'));
  });

  it('a space admin cannot grant own', async () => {
    const { entity: target } = await spaceMember('member');
    expect((await grantTo('admin', target, onSpace('own'))).status).toBe(403);
  });

  it('a flat map of actions is not an entitlement', async () => {
    const { entity: target } = await spaceMember('member');
    expect((await grantTo('owner', target, { operate: true })).status).toBe(422);
  });
});
