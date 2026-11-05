import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Project,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import { Role } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createProject,
  createSpace,
  createSpaceUser,
  createTag,
  createTagAttachment,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { projectRouter } from '#/modules/project';
import { spaceRouter } from '#/modules/space';
import { spaceUserRouter } from '#/modules/spaceUser';
import { createTestApp } from '#tests/createTestApp';
import { del, get, json, patch, post } from '#tests/utils/request';

const appFor = (user: User, organizationUsers: OrganizationUser[], spaceUsers: SpaceUser[] = []) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: organizationUsers,
    mockSpaceUsers: spaceUsers,
    mount: [
      (app) => app.route('/api/v1/project', projectRouter),
      (app) => app.route('/api/v1/me', meRouter),
      (app) => app.route('/api/v1/organization', organizationRouter),
      (app) => app.route('/api/v1/organizationUser', organizationUserRouter),
      (app) => app.route('/api/v1/space', spaceRouter),
      (app) => app.route('/api/v1/spaceUser', spaceUserRouter),
    ],
  });

describe('Project', () => {
  let user: User;
  let organization: Organization;
  let organizationUser: OrganizationUser;
  let space: Space;
  let spaceUser: SpaceUser;
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    const created = await createOrganizationUser({ role: Role.owner });
    organizationUser = created.entity;
    user = created.context.user;
    organization = created.context.organization;
    space = (await createSpace({}, { organization })).entity;
    spaceUser = (
      await createSpaceUser({ role: Role.owner }, { organization, user, organizationUser, space })
    ).entity;
    app = appFor(user, [organizationUser], [spaceUser]);
  });

  afterAll(async () => {
    await cleanupTouchedTables(app.db);
    clearHookRegistry();
  });

  describe('each of the five owners creates and lists its own projects', () => {
    const owners = () => [
      { path: '/api/v1/me', ownerModel: 'User', ids: { userId: user.id } },
      {
        path: `/api/v1/organization/${organization.id}`,
        ownerModel: 'Organization',
        ids: { organizationId: organization.id },
      },
      {
        path: `/api/v1/organizationUser/${organizationUser.id}`,
        ownerModel: 'OrganizationUser',
        ids: { organizationId: organization.id, userId: user.id },
      },
      {
        path: `/api/v1/space/${space.id}`,
        ownerModel: 'Space',
        ids: { organizationId: organization.id, spaceId: space.id },
      },
      {
        path: `/api/v1/spaceUser/${spaceUser.id}`,
        ownerModel: 'SpaceUser',
        ids: { organizationId: organization.id, spaceId: space.id, userId: user.id },
      },
    ];

    it('creates a project under every owner kind, with the same name in each', async () => {
      const name = `Template ${getNextSeq()}`;
      for (const owner of owners()) {
        const response = await app.fetch(
          post(`${owner.path}/projects`, { name, description: 'the base repo' }),
        );
        const { data } = await json<Project>(response);
        expect(response.status).toBe(201);
        expect(data).toMatchObject({ name, ownerModel: owner.ownerModel, ...owner.ids });
      }
    });

    it("lists only that owner's projects", async () => {
      const name = `Listed ${getNextSeq()}`;
      for (const owner of owners()) {
        await app.fetch(post(`${owner.path}/projects`, { name: `${name} ${owner.ownerModel}` }));
      }
      for (const owner of owners()) {
        const response = await app.fetch(get(`${owner.path}/projects`));
        const { data } = await json<Project[]>(response);
        expect(response.status).toBe(200);
        const listed = data.filter((project) => project.name.startsWith(name));
        expect(listed.map((project) => project.name)).toEqual([`${name} ${owner.ownerModel}`]);
        expect(data.every((project) => project.ownerModel === owner.ownerModel)).toBe(true);
      }
    });

    it('refuses a blank name (422)', async () => {
      expect((await app.fetch(post('/api/v1/me/projects', { name: '   ' }))).status).toBe(422);
    });

    it('refuses a second live project with the same name under one owner (409)', async () => {
      const name = `Twice ${getNextSeq()}`;
      expect((await app.fetch(post('/api/v1/me/projects', { name }))).status).toBe(201);
      expect((await app.fetch(post('/api/v1/me/projects', { name }))).status).toBe(409);
    });

    it("refuses owner fields in the body: a project can't be planted on someone else (422)", async () => {
      const { entity: otherUser } = await createUser();
      const response = await app.fetch(
        post('/api/v1/me/projects', { name: `Mine ${getNextSeq()}`, userId: otherUser.id }),
      );
      expect(response.status).toBe(422);
    });
  });

  describe('a project record', () => {
    it('is read, renamed and tombstoned by its owner; the name is free again after', async () => {
      const name = `Doomed ${getNextSeq()}`;
      const { entity: project } = await createProject({
        name,
        ownerModel: 'User',
        userId: user.id,
      });

      expect((await app.fetch(get(`/api/v1/project/${project.id}`))).status).toBe(200);

      const renamed = await app.fetch(
        patch(`/api/v1/project/${project.id}`, { description: 'renamed' }),
      );
      expect((await json<Project>(renamed)).data.description).toBe('renamed');

      expect((await app.fetch(del(`/api/v1/project/${project.id}`))).status).toBe(204);
      expect((await app.fetch(get(`/api/v1/project/${project.id}`))).status).toBe(404);
      expect((await app.fetch(post('/api/v1/me/projects', { name }))).status).toBe(201);
    });

    it("keeps its owner: a PATCH can't move it to another owner (422)", async () => {
      const { entity: otherUser } = await createUser();
      const { entity: project } = await createProject({ ownerModel: 'User', userId: user.id });
      const response = await app.fetch(
        patch(`/api/v1/project/${project.id}`, { ownerModel: 'User', userId: otherUser.id }),
      );
      expect(response.status).toBe(422);
      const unchanged = await app.db.project.findUniqueOrThrow({ where: { id: project.id } });
      expect(unchanged.userId).toBe(user.id);
    });

    it('is closed to another person: their personal project is 403 to read or change', async () => {
      const { entity: otherUser } = await createUser();
      const { entity: project } = await createProject({ ownerModel: 'User', userId: otherUser.id });
      expect((await app.fetch(get(`/api/v1/project/${project.id}`))).status).toBe(403);
      expect(
        (await app.fetch(patch(`/api/v1/project/${project.id}`, { name: 'Hacked' }))).status,
      ).toBe(403);
      expect((await app.fetch(del(`/api/v1/project/${project.id}`))).status).toBe(403);
    });
  });

  describe("an organization's people", () => {
    const memberOf = async (role: Role) => {
      const created = await createOrganizationUser({ role }, { organization });
      return { ...created, app: appFor(created.context.user, [created.entity]) };
    };

    it('a member reads an organization project but cannot change it', async () => {
      const member = await memberOf(Role.member);
      const { entity: project } = await createProject({
        ownerModel: 'Organization',
        organizationId: organization.id,
      });
      expect((await member.app.fetch(get(`/api/v1/project/${project.id}`))).status).toBe(200);
      expect(
        (await member.app.fetch(patch(`/api/v1/project/${project.id}`, { name: 'Edit' }))).status,
      ).toBe(403);
      expect(
        (
          await member.app.fetch(
            post(`/api/v1/organization/${organization.id}/projects`, { name: 'x' }),
          )
        ).status,
      ).toBe(403);
    });

    it("an admin can't reach a member's own project, while the organization owner can", async () => {
      const member = await memberOf(Role.member);
      const { entity: project } = await createProject({
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: member.context.user.id,
      });

      const admin = await memberOf(Role.admin);
      expect((await admin.app.fetch(get(`/api/v1/project/${project.id}`))).status).toBe(403);

      expect((await app.fetch(get(`/api/v1/project/${project.id}`))).status).toBe(200);
      expect((await member.app.fetch(get(`/api/v1/project/${project.id}`))).status).toBe(200);
    });

    it("an admin can't list a member's projects", async () => {
      const member = await memberOf(Role.member);
      const admin = await memberOf(Role.admin);
      const response = await admin.app.fetch(
        get(`/api/v1/organizationUser/${member.entity.id}/projects`),
      );
      expect(response.status).toBe(403);
    });

    it('another organization cannot see the project at all', async () => {
      const { entity: project } = await createProject({
        ownerModel: 'Organization',
        organizationId: organization.id,
      });
      const outsider = await createOrganizationUser({ role: Role.owner });
      const outsiderApp = appFor(outsider.context.user, [outsider.entity]);
      expect((await outsiderApp.fetch(get(`/api/v1/project/${project.id}`))).status).toBe(403);
    });
  });

  describe('tags', () => {
    it('a project takes tag attachments like the other tag resources', async () => {
      const { entity: project } = await createProject({ ownerModel: 'User', userId: user.id });
      const { entity: tag } = await createTag();
      const { entity: attachment } = await createTagAttachment(
        { resourceModel: 'Project' },
        { tag, project },
      );
      const tagged = await app.db.project.findUniqueOrThrow({
        where: { id: project.id },
        include: { tagAttachments: true },
      });
      expect(tagged.tagAttachments.map((row) => row.id)).toEqual([attachment.id]);
    });
  });
});
