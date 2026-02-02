import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, OrganizationUser, Space, SpaceUser, User } from '@template/db';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
} from '@template/db/test';
import { spaceUserRouter } from '#/modules/spaceUser';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { del, post } from '#tests/utils/request';

describe('SpaceUser Token Permissions', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;
  let space: Space;

  // Users with different roles
  let ownerUser: User;
  let ownerOrgUser: OrganizationUser;
  let ownerSpaceUser: SpaceUser;
  let adminUser: User;
  let adminOrgUser: OrganizationUser;
  let adminSpaceUser: SpaceUser;
  let memberUser: User;
  let memberOrgUser: OrganizationUser;
  let memberSpaceUser: SpaceUser;
  let viewerUser: User;
  let viewerOrgUser: OrganizationUser;
  let viewerSpaceUser: SpaceUser;

  beforeAll(async () => {
    // Create org and space first
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: s } = await createSpace({}, { organization: org });
    space = s;

    // Create users with matching org and space roles
    // Pass full context so factory reuses user/org entities
    const { entity: ou1, context: c1 } = await createOrganizationUser({ role: 'owner' }, { organization: org });
    ownerOrgUser = ou1;
    ownerUser = c1.user;
    const { entity: su1 } = await createSpaceUser({ role: 'owner' }, { ...c1, space });
    ownerSpaceUser = su1;

    const { entity: ou2, context: c2 } = await createOrganizationUser({ role: 'admin' }, { organization: org });
    adminOrgUser = ou2;
    adminUser = c2.user;
    const { entity: su2 } = await createSpaceUser({ role: 'admin' }, { ...c2, space });
    adminSpaceUser = su2;

    const { entity: ou3, context: c3 } = await createOrganizationUser({ role: 'member' }, { organization: org });
    memberOrgUser = ou3;
    memberUser = c3.user;
    const { entity: su3 } = await createSpaceUser({ role: 'member' }, { ...c3, space });
    memberSpaceUser = su3;

    const { entity: ou4, context: c4 } = await createOrganizationUser({ role: 'viewer' }, { organization: org });
    viewerOrgUser = ou4;
    viewerUser = c4.user;
    const { entity: su4 } = await createSpaceUser({ role: 'viewer' }, { ...c4, space });
    viewerSpaceUser = su4;

    db = createTestApp().db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const createApp = (user: User, orgUsers: OrganizationUser[], spaceUsers: SpaceUser[]) =>
    createTestApp({
      mockUser: user,
      mockOrganizationUsers: orgUsers,
      mockSpaceUsers: spaceUsers,
      mount: [
        (app) => app.route('/api/v1/spaceUser', spaceUserRouter),
        (app) => app.route('/api/v1/token', tokenRouter),
      ],
    });

  describe('Token Creation', () => {
    it('owner can create owner-role token', async () => {
      const { fetch } = createApp(ownerUser, [ownerOrgUser], [ownerSpaceUser]);
      const response = await fetch(post(`/api/v1/spaceUser/${ownerSpaceUser.id}/tokens`, { name: 'Owner Token', role: 'owner' }));
      expect(response.status).toBe(201);
    });

    it('owner can create member-role token', async () => {
      const { fetch } = createApp(ownerUser, [ownerOrgUser], [ownerSpaceUser]);
      const response = await fetch(post(`/api/v1/spaceUser/${ownerSpaceUser.id}/tokens`, { name: 'Member Token', role: 'member' }));
      expect(response.status).toBe(201);
    });

    it('admin can create admin-role token', async () => {
      const { fetch } = createApp(adminUser, [adminOrgUser], [adminSpaceUser]);
      const response = await fetch(post(`/api/v1/spaceUser/${adminSpaceUser.id}/tokens`, { name: 'Admin Token', role: 'admin' }));
      expect(response.status).toBe(201);
    });

    it('admin can create member-role token', async () => {
      const { fetch } = createApp(adminUser, [adminOrgUser], [adminSpaceUser]);
      const response = await fetch(post(`/api/v1/spaceUser/${adminSpaceUser.id}/tokens`, { name: 'Member Token', role: 'member' }));
      expect(response.status).toBe(201);
    });

    it('admin cannot create owner-role token', async () => {
      const { fetch } = createApp(adminUser, [adminOrgUser], [adminSpaceUser]);
      const response = await fetch(post(`/api/v1/spaceUser/${adminSpaceUser.id}/tokens`, { name: 'Owner Token', role: 'owner' }));
      expect(response.status).toBe(403);
    });

    it('member can create member-role token', async () => {
      const { fetch } = createApp(memberUser, [memberOrgUser], [memberSpaceUser]);
      const response = await fetch(post(`/api/v1/spaceUser/${memberSpaceUser.id}/tokens`, { name: 'Member Token', role: 'member' }));
      expect(response.status).toBe(201);
    });

    it('member cannot create admin-role token', async () => {
      const { fetch } = createApp(memberUser, [memberOrgUser], [memberSpaceUser]);
      const response = await fetch(post(`/api/v1/spaceUser/${memberSpaceUser.id}/tokens`, { name: 'Admin Token', role: 'admin' }));
      expect(response.status).toBe(403);
    });

    it('cannot create token for another user', async () => {
      const { fetch } = createApp(adminUser, [adminOrgUser], [adminSpaceUser]);
      // Try to create a token for member's spaceUser
      const response = await fetch(post(`/api/v1/spaceUser/${memberSpaceUser.id}/tokens`, { name: 'Token', role: 'member' }));
      expect(response.status).toBe(403);
    });
  });

  describe('Token Deletion', () => {
    it('user can delete their own token', async () => {
      const { entity: token } = await createToken({ ownerModel: 'SpaceUser', role: 'member' }, { spaceUser: memberSpaceUser });
      const { fetch } = createApp(memberUser, [memberOrgUser], [memberSpaceUser]);
      const response = await fetch(del(`/api/v1/token/${token.id}`));
      expect(response.status).toBe(204);
    });

    it('owner can delete member token via space permission', async () => {
      const { entity: token } = await createToken({ ownerModel: 'SpaceUser', role: 'member' }, { spaceUser: memberSpaceUser });
      const { fetch } = createApp(ownerUser, [ownerOrgUser], [ownerSpaceUser]);
      const response = await fetch(del(`/api/v1/token/${token.id}`));
      expect(response.status).toBe(204);
    });

    it('admin can delete member token via space permission', async () => {
      const { entity: token } = await createToken({ ownerModel: 'SpaceUser', role: 'member' }, { spaceUser: memberSpaceUser });
      const { fetch } = createApp(adminUser, [adminOrgUser], [adminSpaceUser]);
      const response = await fetch(del(`/api/v1/token/${token.id}`));
      expect(response.status).toBe(204);
    });

    it('admin cannot delete owner token', async () => {
      const { entity: token } = await createToken({ ownerModel: 'SpaceUser', role: 'owner' }, { spaceUser: ownerSpaceUser });
      const { fetch } = createApp(adminUser, [adminOrgUser], [adminSpaceUser]);
      const response = await fetch(del(`/api/v1/token/${token.id}`));
      expect(response.status).toBe(403);
    });

    it('member cannot delete another member token', async () => {
      // Create another member - pass full context
      const { entity: otherMemberOrgUser, context: otherCtx } = await createOrganizationUser({ role: 'member' }, { organization: org });
      const { entity: otherMemberSpaceUser } = await createSpaceUser({ role: 'member' }, { ...otherCtx, space });
      const { entity: token } = await createToken({ ownerModel: 'SpaceUser', role: 'member' }, { spaceUser: otherMemberSpaceUser });
      const { fetch } = createApp(memberUser, [memberOrgUser], [memberSpaceUser]);
      const response = await fetch(del(`/api/v1/token/${token.id}`));
      expect(response.status).toBe(403);
    });
  });
});
