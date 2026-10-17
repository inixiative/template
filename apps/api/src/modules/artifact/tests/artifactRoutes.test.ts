import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import type {
  Artifact,
  ArtifactContainer,
  Organization,
  OrganizationUser,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
  createUser,
} from '@template/db/test';
import { registerArtifactAccessHook } from '#/hooks/artifactAccess/hook';
import type { TokenWithRelations } from '#/lib/context/types';
import { artifactRouter } from '#/modules/artifact';
import { artifactContainerRouter } from '#/modules/artifactContainer';
import { artifactPermissionRouter } from '#/modules/artifactPermission';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { del, get, json, patch, post } from '#tests/utils/request';

const mount: MountFn[] = [
  (app) => {
    app.route('/api/v1/artifact', artifactRouter);
    app.route('/api/v1/artifactContainer', artifactContainerRouter);
    app.route('/api/v1/artifactPermission', artifactPermissionRouter);
    app.route('/api/v1/me', meRouter);
    app.route('/api/v1/organization', organizationRouter);
  },
];

type Fetch = ReturnType<typeof createTestApp>['fetch'];

describe('artifact routes', () => {
  let organization: Organization;
  let admin: User;
  let member: User;
  let memberMembership: OrganizationUser;
  let outsider: User;
  let adminFetch: Fetch;
  let memberFetch: Fetch;
  let outsiderFetch: Fetch;
  let testDb: ReturnType<typeof createTestApp>['db'];
  let shared: Artifact;
  let drafts: Artifact;
  let edge: ArtifactContainer;

  const createFolder = async (fetch: Fetch, path: string, body: Record<string, unknown> = {}) => {
    const response = await fetch(post(path, { kind: 'folder', name: 'folder', ...body }));
    expect(response.status).toBe(201);
    return (await json<Artifact>(response)).data;
  };

  const place = (fetch: Fetch, artifact: Artifact, container: Artifact) =>
    fetch(
      post(`/api/v1/artifact/${artifact.id}/artifactContainers`, {
        containerArtifactId: container.id,
      }),
    );

  beforeAll(async () => {
    registerArtifactAccessHook();
    const adminSeat = await createOrganizationUser({ role: 'admin' });
    organization = adminSeat.context.organization;
    admin = adminSeat.context.user;
    memberMembership = (await createOrganizationUser({ role: 'member' }, { organization })).entity;
    member = await db.user.findUniqueOrThrow({ where: { id: memberMembership.userId } });
    outsider = (await createUser()).entity;

    const harness = createTestApp({
      mockUser: admin,
      mockOrganizationUsers: [adminSeat.entity],
      mount,
    });
    adminFetch = harness.fetch;
    testDb = harness.db;
    memberFetch = createTestApp({
      mockUser: member,
      mockOrganizationUsers: [memberMembership],
      mount,
    }).fetch;
    outsiderFetch = createTestApp({ mockUser: outsider, mount }).fetch;

    shared = await createFolder(adminFetch, `/api/v1/organization/${organization.id}/artifacts`);
    const grant = await adminFetch(
      post(`/api/v1/artifact/${shared.id}/artifactPermissions`, {
        granteeModel: 'OrganizationUser',
        granteeOrganizationId: organization.id,
        granteeUserId: member.id,
        role: 'member',
      }),
    );
    expect(grant.status).toBe(201);
  });

  afterAll(async () => {
    await cleanupTouchedTables(testDb);
    clearHookRegistry();
  });

  it('creates at the kind default and gives the creating member an owner grant', async () => {
    drafts = await createFolder(memberFetch, `/api/v1/organization/${organization.id}/artifacts`);
    expect(drafts.ownerModel).toBe('Organization');
    expect(drafts.access).toBe('private');
    const access = await memberFetch(get(`/api/v1/artifact/${drafts.id}/access`));
    expect((await json<{ role: string }>(access)).data.role).toBe('owner');
  });

  it('creating inside a container inherits by default', async () => {
    const inside = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      {
        containerArtifactId: shared.id,
      },
    );
    expect(inside.access).toBe('inherit');
  });

  it('an edge needs manage on the artifact and operate on the container', async () => {
    const response = await place(memberFetch, drafts, shared);
    expect(response.status).toBe(201);
    edge = (await json<ArtifactContainer>(response)).data;
    const placed = await db.artifact.findUniqueOrThrow({ where: { id: drafts.id } });
    expect(placed.access).toBe('inherit');
  });

  it("a viewer-role token cannot use its user's owner grant", async () => {
    const { entity: token } = await createToken({
      ownerModel: 'User',
      userId: member.id,
      role: 'viewer',
    });
    const mockToken: TokenWithRelations = {
      ...token,
      user: member,
      organization: null,
      organizationUser: null,
      space: null,
      spaceUser: null,
    };
    const tokenFetch = createTestApp({
      mockUser: member,
      mockOrganizationUsers: [memberMembership],
      mockToken,
      mount,
    }).fetch;
    const viewerOwned = await createFolder(
      memberFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
    );
    const access = await tokenFetch(get(`/api/v1/artifact/${viewerOwned.id}/access`));
    expect((await json<{ role: string }>(access)).data.role).toBe('viewer');
    expect((await place(tokenFetch, viewerOwned, shared)).status).toBe(403);
  });

  it('placing an artifact that already sits somewhere keeps its explicit access', async () => {
    const group = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      {
        access: 'public',
      },
    );
    const secret = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      {
        containerArtifactId: group.id,
        access: 'private',
      },
    );
    const other = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
    );
    expect((await place(adminFetch, secret, other)).status).toBe(201);
    const after = await db.artifact.findUniqueOrThrow({ where: { id: secret.id } });
    expect(after.access).toBe('private');
  });

  it("a space-scoped token does not reach its user's personal artifacts", async () => {
    const space = (await createSpace({}, { organization })).entity;
    const { entity: spaceUser } = await createSpaceUser(
      { role: 'admin' },
      { organization, space, user: member, organizationUser: memberMembership },
    );
    const { entity: token } = await createToken({
      ownerModel: 'SpaceUser',
      organizationId: organization.id,
      spaceId: space.id,
      userId: member.id,
      role: 'viewer',
    });
    const tokenFetch = createTestApp({
      mockUser: member,
      mockOrganizationUsers: [memberMembership],
      mockSpaceUsers: [spaceUser],
      mockToken: {
        ...token,
        user: member,
        organization: null,
        organizationUser: null,
        space: null,
        spaceUser: null,
      },
      mount,
    }).fetch;
    const personal = await createFolder(memberFetch, '/api/v1/me/artifacts');
    expect((await tokenFetch(get(`/api/v1/artifact/${personal.id}/access`))).status).toBe(404);
  });

  it('refuses an edge when the caller only operates on the artifact', async () => {
    const response = await place(memberFetch, shared, drafts);
    expect(response.status).toBe(403);
  });

  it('answers 404 when the caller cannot see the container', async () => {
    const own = await createFolder(outsiderFetch, '/api/v1/me/artifacts');
    const response = await place(outsiderFetch, own, shared);
    expect(response.status).toBe(404);
  });

  it('refuses a loop', async () => {
    const response = await place(adminFetch, shared, drafts);
    expect(response.status).toBe(422);
  });

  it("refuses a folder in another owner's container: crossing owners is a copy", async () => {
    const personal = await createFolder(adminFetch, '/api/v1/me/artifacts');
    const response = await place(adminFetch, personal, shared);
    expect(response.status).toBe(422);
  });

  it('lists only the members the caller can read', async () => {
    const hidden = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
    );
    await place(adminFetch, hidden, shared);
    await db.artifact.update({ where: { id: hidden.id }, data: { access: 'private' } });

    const asAdmin = await json<Artifact[]>(
      await adminFetch(get(`/api/v1/artifact/${shared.id}/artifacts`)),
    );
    expect(asAdmin.data.map((artifact) => artifact.id)).toContain(hidden.id);
    const asMember = await json<Artifact[]>(
      await memberFetch(get(`/api/v1/artifact/${shared.id}/artifacts`)),
    );
    expect(asMember.data.map((artifact) => artifact.id)).toContain(drafts.id);
    expect(asMember.data.map((artifact) => artifact.id)).not.toContain(hidden.id);
  });

  it('a grant cannot exceed the granter own role', async () => {
    const grantOutsider = await adminFetch(
      post(`/api/v1/artifact/${shared.id}/artifactPermissions`, {
        granteeModel: 'User',
        granteeUserId: outsider.id,
        role: 'admin',
      }),
    );
    expect(grantOutsider.status).toBe(201);

    const tooHigh = await outsiderFetch(
      post(`/api/v1/artifact/${shared.id}/artifactPermissions`, {
        granteeModel: 'User',
        granteeUserId: member.id,
        role: 'owner',
      }),
    );
    expect(tooHigh.status).toBe(403);

    const ownerGrant = await db.artifactPermission.findFirstOrThrow({
      where: { artifactId: shared.id, role: 'owner', granteeModel: 'OrganizationUser' },
    });
    const demote = await outsiderFetch(
      patch(`/api/v1/artifactPermission/${ownerGrant.id}`, { role: 'viewer' }),
    );
    expect(demote.status).toBe(403);
    expect((await outsiderFetch(del(`/api/v1/artifactPermission/${ownerGrant.id}`))).status).toBe(
      403,
    );
  });

  it('removing its last folder needs both sides; it then shows at its owner root', async () => {
    const stranger = (await createUser()).entity;
    const strangerFetch = createTestApp({ mockUser: stranger, mount }).fetch;
    expect((await strangerFetch(del(`/api/v1/artifactContainer/${edge.id}`))).status).toBe(404);
    expect((await memberFetch(del(`/api/v1/artifactContainer/${edge.id}`))).status).toBe(204);
    const roots = await json<Artifact[]>(
      await memberFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
    );
    expect(roots.data.map((artifact) => artifact.id)).toContain(drafts.id);
  });
});
