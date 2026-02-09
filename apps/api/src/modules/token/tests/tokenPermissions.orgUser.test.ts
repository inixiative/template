import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, OrganizationUser, User } from '@template/db';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createToken,
  createUser,
} from '@template/db/test';
import { organizationUserRouter } from '#/modules/organizationUser';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { del, json, post } from '#tests/utils/request';

describe('OrganizationUser Token Permissions', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;

  // Users with different roles
  let ownerUser: User;
  let ownerOrgUser: OrganizationUser;
  let adminUser: User;
  let adminOrgUser: OrganizationUser;
  let memberUser: User;
  let memberOrgUser: OrganizationUser;
  let viewerUser: User;
  let viewerOrgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity: o } = await createOrganization();
    org = o;

    // Create users with different roles
    const { entity: ou1, context: c1 } = await createOrganizationUser({ role: 'owner' }, { organization: org });
    ownerOrgUser = ou1;
    ownerUser = c1.user;

    const { entity: ou2, context: c2 } = await createOrganizationUser({ role: 'admin' }, { organization: org });
    adminOrgUser = ou2;
    adminUser = c2.user;

    const { entity: ou3, context: c3 } = await createOrganizationUser({ role: 'member' }, { organization: org });
    memberOrgUser = ou3;
    memberUser = c3.user;

    const { entity: ou4, context: c4 } = await createOrganizationUser({ role: 'viewer' }, { organization: org });
    viewerOrgUser = ou4;
    viewerUser = c4.user;

    db = createTestApp().db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const createApp = (user: User, orgUsers: OrganizationUser[]) =>
    createTestApp({
      mockUser: user,
      mockOrganizationUsers: orgUsers,
      mount: [
        (app) => app.route('/api/v1/organizationUser', organizationUserRouter),
        (app) => app.route('/api/v1/token', tokenRouter),
      ],
    });

  describe('Token Creation', () => {
    it('owner can create owner-role token', async () => {
      const { fetch } = createApp(ownerUser, [ownerOrgUser]);
      const response = await fetch(
        post(`/api/v1/organizationUser/${ownerOrgUser.id}/tokens`, { name: 'Owner Token', role: 'owner' }),
      );
      expect(response.status).toBe(201);
    });

    it('owner can create member-role token', async () => {
      const { fetch } = createApp(ownerUser, [ownerOrgUser]);
      const response = await fetch(
        post(`/api/v1/organizationUser/${ownerOrgUser.id}/tokens`, { name: 'Member Token', role: 'member' }),
      );
      expect(response.status).toBe(201);
    });

    it('admin can create admin-role token', async () => {
      const { fetch } = createApp(adminUser, [adminOrgUser]);
      const response = await fetch(
        post(`/api/v1/organizationUser/${adminOrgUser.id}/tokens`, { name: 'Admin Token', role: 'admin' }),
      );
      expect(response.status).toBe(201);
    });

    it('admin can create member-role token', async () => {
      const { fetch } = createApp(adminUser, [adminOrgUser]);
      const response = await fetch(
        post(`/api/v1/organizationUser/${adminOrgUser.id}/tokens`, { name: 'Member Token', role: 'member' }),
      );
      expect(response.status).toBe(201);
    });

    it('admin cannot create owner-role token', async () => {
      const { fetch } = createApp(adminUser, [adminOrgUser]);
      const response = await fetch(
        post(`/api/v1/organizationUser/${adminOrgUser.id}/tokens`, { name: 'Owner Token', role: 'owner' }),
      );
      expect(response.status).toBe(403);
    });

    it('member can create member-role token', async () => {
      const { fetch } = createApp(memberUser, [memberOrgUser]);
      const response = await fetch(
        post(`/api/v1/organizationUser/${memberOrgUser.id}/tokens`, { name: 'Member Token', role: 'member' }),
      );
      expect(response.status).toBe(201);
    });

    it('member cannot create admin-role token', async () => {
      const { fetch } = createApp(memberUser, [memberOrgUser]);
      const response = await fetch(
        post(`/api/v1/organizationUser/${memberOrgUser.id}/tokens`, { name: 'Admin Token', role: 'admin' }),
      );
      expect(response.status).toBe(403);
    });

    it('cannot create token for another user', async () => {
      const { fetch } = createApp(adminUser, [adminOrgUser]);
      // Try to create a token for member's orgUser
      const response = await fetch(
        post(`/api/v1/organizationUser/${memberOrgUser.id}/tokens`, { name: 'Token', role: 'member' }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('Token Deletion', () => {
    it('user can delete their own token', async () => {
      const { entity: token } = await createToken(
        { ownerModel: 'OrganizationUser', role: 'member' },
        { organizationUser: memberOrgUser },
      );
      const { fetch } = createApp(memberUser, [memberOrgUser]);
      const response = await fetch(del(`/api/v1/token/${token.id}`));
      expect(response.status).toBe(204);
    });

    it('owner can delete member token via org permission', async () => {
      const { entity: token } = await createToken(
        { ownerModel: 'OrganizationUser', role: 'member' },
        { organizationUser: memberOrgUser },
      );
      const { fetch } = createApp(ownerUser, [ownerOrgUser]);
      const response = await fetch(del(`/api/v1/token/${token.id}`));
      expect(response.status).toBe(204);
    });

    it('admin can delete member token via org permission', async () => {
      const { entity: token } = await createToken(
        { ownerModel: 'OrganizationUser', role: 'member' },
        { organizationUser: memberOrgUser },
      );
      const { fetch } = createApp(adminUser, [adminOrgUser]);
      const response = await fetch(del(`/api/v1/token/${token.id}`));
      expect(response.status).toBe(204);
    });

    it('admin cannot delete owner token', async () => {
      const { entity: token } = await createToken(
        { ownerModel: 'OrganizationUser', role: 'owner' },
        { organizationUser: ownerOrgUser },
      );
      const { fetch } = createApp(adminUser, [adminOrgUser]);
      const response = await fetch(del(`/api/v1/token/${token.id}`));
      expect(response.status).toBe(403);
    });

    it('member cannot delete another member token', async () => {
      // Create another member
      const { entity: otherMemberOrgUser } = await createOrganizationUser({ role: 'member' }, { organization: org });
      const { entity: token } = await createToken(
        { ownerModel: 'OrganizationUser', role: 'member' },
        { organizationUser: otherMemberOrgUser },
      );
      const { fetch } = createApp(memberUser, [memberOrgUser]);
      const response = await fetch(del(`/api/v1/token/${token.id}`));
      expect(response.status).toBe(403);
    });
  });
});
