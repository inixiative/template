import { beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type {
  Artifact,
  ArtifactPlacement,
  Organization,
  OrganizationUser,
  User,
} from '@template/db/generated/client/client';
import {
  createArtifact,
  createArtifactPermission,
  createArtifactPlacement,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
  createUser,
} from '@template/db/test';
import type { TokenWithRelations } from '#/lib/context/types';
import { artifactRouter } from '#/modules/artifact';
import { artifactPermissionRouter } from '#/modules/artifactPermission';
import { artifactPlacementRouter } from '#/modules/artifactPlacement';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { spaceRouter } from '#/modules/space';
import { userRouter } from '#/modules/user';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { del, get, parseSuccessBody, patch, post } from '#tests/utils/request';

const mount: MountFn[] = [
  (app) => {
    app.route('/api/v1/artifact', artifactRouter);
    app.route('/api/v1/artifactPlacement', artifactPlacementRouter);
    app.route('/api/v1/artifactPermission', artifactPermissionRouter);
    app.route('/api/v1/me', meRouter);
    app.route('/api/v1/organization', organizationRouter);
    app.route('/api/v1/organizationUser', organizationUserRouter);
    app.route('/api/v1/space', spaceRouter);
    app.route('/api/v1/user', userRouter);
  },
];

type Fetch = ReturnType<typeof createTestApp>['fetch'];

describe('artifact routes', () => {
  let organization: Organization;
  let admin: User;
  let adminMembership: OrganizationUser;
  let member: User;
  let memberMembership: OrganizationUser;
  let outsider: User;
  let adminFetch: Fetch;
  let memberFetch: Fetch;
  let outsiderFetch: Fetch;
  let shared: Artifact;
  let drafts: Artifact;

  const createFolder = async (fetch: Fetch, path: string, body: Record<string, unknown> = {}) => {
    const response = await fetch(post(path, { kind: 'folder', name: 'folder', ...body }));
    expect(response.status).toBe(201);
    return (await parseSuccessBody<Artifact>(response)).data;
  };

  const place = (fetch: Fetch, artifact: Artifact, container: Artifact) =>
    fetch(
      post(`/api/v1/artifact/${artifact.id}/artifactPlacements`, {
        containerArtifactId: container.id,
      }),
    );

  const placeDraftsInShared = async () => {
    const response = await place(memberFetch, drafts, shared);
    expect(response.status).toBe(201);
    return (await parseSuccessBody<ArtifactPlacement>(response)).data;
  };

  beforeEach(async () => {
    const adminSeat = await createOrganizationUser({ role: 'admin' });
    organization = adminSeat.context.organization;
    admin = adminSeat.context.user;
    adminMembership = adminSeat.entity;
    memberMembership = (await createOrganizationUser({ role: 'member' }, { organization })).entity;
    member = await db.user.findUniqueOrThrow({ where: { id: memberMembership.userId } });
    outsider = (await createUser()).entity;

    const harness = createTestApp({
      mockUser: admin,
      mockOrganizationUsers: [adminSeat.entity],
      mount,
    });
    adminFetch = harness.fetch;
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
    drafts = await createFolder(adminFetch, `/api/v1/organization/${organization.id}/artifacts`);
    expect(
      (
        await adminFetch(
          post(`/api/v1/artifact/${drafts.id}/artifactPermissions`, {
            granteeModel: 'OrganizationUser',
            granteeOrganizationId: organization.id,
            granteeUserId: member.id,
            role: 'admin',
          }),
        )
      ).status,
    ).toBe(201);
  });

  it('organization root creation requires manage; member workspaces stay open to the member', async () => {
    expect(
      (
        await memberFetch(
          post(`/api/v1/organization/${organization.id}/artifacts`, {
            kind: 'folder',
            name: 'denied',
          }),
        )
      ).status,
    ).toBe(403);
    const created = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
    );
    expect(created.ownerModel).toBe('Organization');
    expect(created.access).toBe('private');
    const detail = await adminFetch(get(`/api/v1/artifact/${created.id}`));
    expect(
      (await parseSuccessBody<{ effectiveAccess: { role: string } }>(detail)).data.effectiveAccess
        .role,
    ).toBe('admin');
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
    await placeDraftsInShared();
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
      targetEntitlements: [],
      user: member,
      organization: null,
      organizationUser: null,
      space: null,
      spaceUser: null,
      integration: null,
    };
    const tokenFetch = createTestApp({
      mockUser: member,
      mockOrganizationUsers: [memberMembership],
      mockToken,
      mount,
    }).fetch;
    const personalOwned = await createFolder(memberFetch, '/api/v1/me/artifacts');
    const detail = await tokenFetch(get(`/api/v1/artifact/${personalOwned.id}`));
    expect(detail.status).toBe(200);
    expect(
      (await parseSuccessBody<{ effectiveAccess: { role: string } }>(detail)).data.effectiveAccess
        .role,
    ).toBe('viewer');
    expect((await place(tokenFetch, personalOwned, shared)).status).toBe(403);
    expect((await tokenFetch(get(`/api/v1/artifact/${drafts.id}`))).status).toBe(403);
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
        targetEntitlements: [],
        user: member,
        organization: null,
        organizationUser: null,
        space: null,
        spaceUser: null,
        integration: null,
      },
      mount,
    }).fetch;
    const personal = await createFolder(memberFetch, '/api/v1/me/artifacts');
    expect((await tokenFetch(get(`/api/v1/artifact/${personal.id}`))).status).toBe(403);
  });

  it('refuses an edge when the caller only operates on the artifact', async () => {
    const response = await place(memberFetch, shared, drafts);
    expect(response.status).toBe(403);
  });

  it('a viewer User token (without mockUser) can list /me/artifacts, cannot create them, and an entitlement-only token does not escalate to owner', async () => {
    const { entity: viewerToken } = await createToken({
      ownerModel: 'User',
      userId: member.id,
      role: 'viewer',
    });
    const viewerTokenFetch = createTestApp({
      mockOrganizationUsers: [memberMembership],
      mockToken: {
        ...viewerToken,
        targetEntitlements: [],
        user: member,
        organization: null,
        organizationUser: null,
        space: null,
        spaceUser: null,
        integration: null,
      },
      mount,
    }).fetch;
    const personal = await createFolder(memberFetch, '/api/v1/me/artifacts');
    expect((await viewerTokenFetch(get('/api/v1/me/artifacts'))).status).toBe(200);
    expect((await viewerTokenFetch(get(`/api/v1/artifact/${personal.id}`))).status).toBe(200);
    expect(
      (await viewerTokenFetch(post('/api/v1/me/artifacts', { kind: 'folder', name: 'blocked' })))
        .status,
    ).toBe(403);

    const { entity: entOnlyToken } = await createToken({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: member.id,
      role: null,
      full: false,
      entitlements: [
        {
          sourceModel: 'Organization',
          sourceId: organization.id,
          resource: 'Organization',
          actions: ['read'],
        },
      ],
    });
    const entOnlyFetch = createTestApp({
      mockOrganizationUsers: [memberMembership],
      mockToken: {
        ...entOnlyToken,
        targetEntitlements: await db.entitlement.findMany({
          where: { targetModel: 'Token', targetTokenId: entOnlyToken.id },
        }),
        user: member,
        organization,
        organizationUser: {
          ...memberMembership,
          organization,
          user: member,
          targetEntitlements: [],
        },
        space: null,
        spaceUser: null,
        integration: null,
      },
      mount,
    }).fetch;
    expect((await entOnlyFetch(get(`/api/v1/artifact/${drafts.id}`))).status).toBe(403);

    const { entity: memberToken } = await createToken({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: member.id,
      role: null,
      full: true,
    });
    const memberTokenFetch = createTestApp({
      mockToken: {
        ...memberToken,
        targetEntitlements: [],
        user: member,
        organization,
        organizationUser: {
          ...memberMembership,
          organization,
          user: member,
          targetEntitlements: await db.entitlement.findMany({
            where: { targetModel: 'OrganizationUser', targetId: memberMembership.id },
          }),
        },
        space: null,
        spaceUser: null,
        integration: null,
      },
      mount,
    }).fetch;
    const tokenDetail = await memberTokenFetch(get(`/api/v1/artifact/${drafts.id}`));
    expect(tokenDetail.status).toBe(200);
    expect(
      (await parseSuccessBody<{ effectiveAccess: { role: string } }>(tokenDetail)).data
        .effectiveAccess.role,
    ).toBe('admin');
  });

  it('refuses a placement whose longest path (despite shortcut edges) exceeds ARTIFACT_MAX_DEPTH', async () => {
    const chain = async (length: number) => {
      const nodes: Artifact[] = [];
      for (let i = 0; i < length; i++) {
        const { entity } = await createArtifact({
          kind: 'folder',
          ownerModel: 'Organization',
          organizationId: organization.id,
        });
        nodes.push(entity);
        if (i > 0) {
          await createArtifactPlacement({
            ownerModel: 'Organization',
            organizationId: organization.id,
            artifactId: entity.id,
            containerArtifactId: nodes[i - 1]!.id,
          });
        }
      }
      return nodes;
    };
    const top = await chain(30);
    const sub = await chain(22);
    for (let i = 2; i < sub.length; i++) {
      await createArtifactPlacement({
        ownerModel: 'Organization',
        organizationId: organization.id,
        artifactId: sub[i]!.id,
        containerArtifactId: sub[0]!.id,
      });
    }
    expect((await place(adminFetch, sub[0]!, top[top.length - 1]!)).status).toBe(422);
  }, 15_000);

  it('answers 403 when the caller cannot access the container', async () => {
    const own = await createFolder(outsiderFetch, '/api/v1/me/artifacts');
    const response = await place(outsiderFetch, own, shared);
    expect(response.status).toBe(403);
  });

  it('refuses a loop', async () => {
    await placeDraftsInShared();
    const response = await place(adminFetch, shared, drafts);
    expect(response.status).toBe(422);
  });

  it('cross-owner placement organizes a shared artifact without inheriting permissions or public status', async () => {
    const personal = await createFolder(outsiderFetch, '/api/v1/me/artifacts');
    const orgPublic = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { access: 'public' },
    );
    // Grant admin read-only access on outsider's private personal folder
    const grant = await parseSuccessBody<{ id: string }>(
      await outsiderFetch(
        post(`/api/v1/artifact/${personal.id}/artifactPermissions`, {
          granteeModel: 'User',
          granteeUserId: admin.id,
          role: 'viewer',
        }),
      ),
    );
    // Admin can place outsider's artifact into orgPublic with only read on artifact + operate on container
    const placed = await place(adminFetch, personal, orgPublic);
    expect(placed.status).toBe(201);
    const edgeId = (await parseSuccessBody<{ id: string }>(placed)).data.id;
    // Cross-owner placement must never make outsider's private artifact public or leak org grants
    expect((await memberFetch(get(`/api/v1/artifact/${personal.id}`))).status).toBe(403);
    const after = await db.artifact.findUniqueOrThrow({ where: { id: personal.id } });
    expect(after.access).toBe('private');
    // Even after outsider revokes admin's read grant, admin can still unlink it from orgPublic
    expect((await outsiderFetch(del(`/api/v1/artifactPermission/${grant.data.id}`))).status).toBe(
      204,
    );
    expect((await adminFetch(get(`/api/v1/artifact/${personal.id}`))).status).toBe(403);
    expect((await adminFetch(del(`/api/v1/artifactPlacement/${edgeId}`))).status).toBe(204);
  });

  it('cross-owner placements do not hide root artifacts or defeat inherit: false on same-owner placements', async () => {
    const aliceFolder = await createFolder(outsiderFetch, '/api/v1/me/artifacts');
    const alicePublic = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      access: 'public',
    });
    const aliceFile = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      containerArtifactId: aliceFolder.id,
    });
    expect(aliceFile.access).toBe('inherit');

    await outsiderFetch(
      post(`/api/v1/artifact/${aliceFile.id}/artifactPermissions`, {
        granteeModel: 'User',
        granteeUserId: admin.id,
        role: 'viewer',
      }),
    );
    const orgPublic = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { access: 'public' },
    );
    expect((await place(adminFetch, aliceFile, orgPublic)).status).toBe(201);

    // Remove from aliceFolder: aliceFile must still show at outsider's root despite sitting in orgPublic
    expect(
      (
        await outsiderFetch(
          post(`/api/v1/artifact/${aliceFile.id}/move`, {
            fromContainerArtifactId: aliceFolder.id,
          }),
        )
      ).status,
    ).toBe(200);
    const roots = await parseSuccessBody<Artifact[]>(
      await outsiderFetch(get('/api/v1/me/artifacts')),
    );
    expect(roots.data.map((artifact) => artifact.id)).toContain(aliceFile.id);

    // Placing into alicePublic with explicit inherit: false must reset access to private (not public!)
    expect(
      (
        await outsiderFetch(
          post(`/api/v1/artifact/${aliceFile.id}/artifactPlacements`, {
            containerArtifactId: alicePublic.id,
            inherit: false,
          }),
        )
      ).status,
    ).toBe(201);
    const after = await db.artifact.findUniqueOrThrow({ where: { id: aliceFile.id } });
    expect(after.access).toBe('private');
    expect((await memberFetch(get(`/api/v1/artifact/${aliceFile.id}`))).status).toBe(403);
  });

  it('moveArtifact refuses cross-owner fromContainer when the artifact is not in it without leaking existence', async () => {
    const victimPrivate = await createFolder(outsiderFetch, '/api/v1/me/artifacts');
    const attackerFolder = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
    );
    expect(
      (
        await adminFetch(
          post(`/api/v1/artifact/${victimPrivate.id}/move`, {
            fromContainerArtifactId: attackerFolder.id,
          }),
        )
      ).status,
    ).toBe(403);
  });

  it('GET /artifact/:id reports effectiveAccess.role as null for strangers on public artifacts', async () => {
    const pub = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { access: 'public' },
    );
    const asOutsider = await parseSuccessBody<{
      effectiveAccess: { role: string | null; access: string };
    }>(await outsiderFetch(get(`/api/v1/artifact/${pub.id}`)));
    expect(asOutsider.data.effectiveAccess).toEqual({ role: null, access: 'public' });

    const asAdmin = await parseSuccessBody<{
      effectiveAccess: { role: string | null; access: string };
    }>(await adminFetch(get(`/api/v1/artifact/${pub.id}`)));
    expect(asAdmin.data.effectiveAccess).toEqual({ role: 'admin', access: 'public' });
  });

  it('PATCH /artifact/:id lets operate rename, requires manage to change access', async () => {
    // member has operate (member role) on shared via beforeEach
    expect(
      (await memberFetch(patch(`/api/v1/artifact/${shared.id}`, { name: 'renamed' }))).status,
    ).toBe(200);
    expect(
      (await memberFetch(patch(`/api/v1/artifact/${shared.id}`, { access: 'public' }))).status,
    ).toBe(403);
    expect(
      (await adminFetch(patch(`/api/v1/artifact/${shared.id}`, { access: 'public' }))).status,
    ).toBe(200);
  });

  it('lists only the children the caller can read on GET /artifact/:id', async () => {
    await placeDraftsInShared();
    const hidden = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
    );
    await place(adminFetch, hidden, shared);
    await db.artifact.update({ where: { id: hidden.id }, data: { access: 'private' } });

    const asAdmin = await parseSuccessBody<{ children: Artifact[] }>(
      await adminFetch(get(`/api/v1/artifact/${shared.id}`)),
    );
    expect(asAdmin.data.children.map((artifact) => artifact.id)).toContain(hidden.id);
    const asMember = await parseSuccessBody<{ children: Artifact[] }>(
      await memberFetch(get(`/api/v1/artifact/${shared.id}`)),
    );
    expect(asMember.data.children.map((artifact) => artifact.id)).toContain(drafts.id);
    expect(asMember.data.children.map((artifact) => artifact.id)).not.toContain(hidden.id);
  });

  it('a grant cannot exceed the granter own role', async () => {
    const ownerSeat = await createOrganizationUser({ role: 'owner' }, { organization });
    const ownerFetch = createTestApp({
      mockUser: ownerSeat.context.user,
      mockOrganizationUsers: [ownerSeat.entity],
      mount,
    }).fetch;

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

    const ownerGrant = (
      await parseSuccessBody<{ id: string }>(
        await ownerFetch(
          post(`/api/v1/artifact/${shared.id}/artifactPermissions`, {
            granteeModel: 'User',
            granteeUserId: admin.id,
            role: 'owner',
          }),
        ),
      )
    ).data;
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
    const edge = await placeDraftsInShared();
    expect((await strangerFetch(del(`/api/v1/artifactPlacement/${edge.id}`))).status).toBe(403);
    expect((await memberFetch(del(`/api/v1/artifactPlacement/${edge.id}`))).status).toBe(204);
    const roots = await parseSuccessBody<Artifact[]>(
      await memberFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
    );
    expect(roots.data.map((artifact) => artifact.id)).toContain(drafts.id);
  });

  it('organizationUser/artifactPermissions stays private to the member; child permissions never shift across filtered neighbors; deletedAt filter is rejected', async () => {
    // 1. Peer / org admin cannot read member's OrganizationUser shared artifactPermissions
    const secret = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'confidential',
    });
    const share = await parseSuccessBody<{ id: string }>(
      await outsiderFetch(
        post(`/api/v1/artifact/${secret.id}/artifactPermissions`, {
          granteeModel: 'OrganizationUser',
          granteeOrganizationId: organization.id,
          granteeUserId: member.id,
          role: 'viewer',
        }),
      ),
    );
    expect(share.data.id).toBeDefined();
    expect(
      (await adminFetch(get(`/api/v1/organizationUser/${memberMembership.id}/artifactPermissions`)))
        .status,
    ).toBe(403);
    const asMember = await parseSuccessBody<{ id: string; artifact: Artifact }[]>(
      await memberFetch(get(`/api/v1/organizationUser/${memberMembership.id}/artifactPermissions`)),
    );
    expect(asMember.data.map((row) => row.artifact.id)).toContain(secret.id);

    // 2. Post-filter index shift regression: [unreadable, manageable, viewerOnly]
    const unreadable = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'a-unreadable', access: 'private' },
    );
    const manageable = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'b-manageable', access: 'private' },
    );
    const viewerOnly = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'c-viewer', access: 'private' },
    );
    await adminFetch(
      post(`/api/v1/artifact/${manageable.id}/artifactPermissions`, {
        granteeModel: 'User',
        granteeUserId: member.id,
        role: 'admin',
      }),
    );
    await adminFetch(
      post(`/api/v1/artifact/${viewerOnly.id}/artifactPermissions`, {
        granteeModel: 'User',
        granteeUserId: member.id,
        role: 'viewer',
      }),
    );
    for (const child of [unreadable, manageable, viewerOnly]) {
      expect(
        (
          await adminFetch(
            post(`/api/v1/artifact/${child.id}/artifactPlacements`, {
              containerArtifactId: shared.id,
              inherit: false,
            }),
          )
        ).status,
      ).toBe(201);
    }
    const detail = await parseSuccessBody<{
      children: (Artifact & { permissions: unknown[] })[];
    }>(await memberFetch(get(`/api/v1/artifact/${shared.id}`)));
    const byId = new Map(detail.data.children.map((child) => [child.id, child]));
    expect(byId.has(unreadable.id)).toBe(false);
    expect(byId.get(manageable.id)!.permissions.length).toBeGreaterThan(0);
    expect(byId.get(viewerOnly.id)!.permissions).toEqual([]);

    // 3. deletedAt filter is rejected by the lens
    expect(
      (await memberFetch(get('/api/v1/me/artifactPermissions?searchFields[deletedAt][not]=null')))
        .status,
    ).toBe(400);
    expect(
      (await adminFetch(get(`/api/v1/organization/${organization.id}/artifacts?orderBy=name:desc`)))
        .status,
    ).toBe(200);
  });

  it('public/tenant SQL reflection works on org, space, and user artifact lists for anonymous, outsider, member, and admin', async () => {
    const anonFetch = createTestApp({ mount }).fetch;
    const pubOrg = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'pub-org', access: 'public' },
    );
    const tenantOrg = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'tenant-org', access: 'tenant' },
    );
    const privateOrg = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'private-org', access: 'private' },
    );

    const asAnon = await parseSuccessBody<(Artifact & { permissions: unknown[] })[]>(
      await anonFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
    );
    expect(asAnon.data.map((a) => a.id)).toEqual([pubOrg.id]);
    expect(asAnon.data[0]!.permissions).toEqual([]);

    const asOutsider = await parseSuccessBody<Artifact[]>(
      await outsiderFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
    );
    expect(asOutsider.data.map((a) => a.id)).toEqual([pubOrg.id]);

    const asMember = await parseSuccessBody<Artifact[]>(
      await memberFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
    );
    const memberIds = asMember.data.map((a) => a.id);
    expect(memberIds).toContain(pubOrg.id);
    expect(memberIds).toContain(tenantOrg.id);
    expect(memberIds).not.toContain(privateOrg.id);

    const asAdmin = await parseSuccessBody<Artifact[]>(
      await adminFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
    );
    const adminIds = asAdmin.data.map((a) => a.id);
    expect(adminIds).toContain(pubOrg.id);
    expect(adminIds).toContain(tenantOrg.id);
    expect(adminIds).toContain(privateOrg.id);

    // Public user catalog via GET /user/:id/artifacts
    const userPub = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'user-pub',
      access: 'public',
    });
    const userPriv = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'user-priv',
      access: 'private',
    });
    const anonUserList = await parseSuccessBody<Artifact[]>(
      await anonFetch(get(`/api/v1/user/${outsider.id}/artifacts`)),
    );
    expect(anonUserList.data.map((a) => a.id)).toEqual([userPub.id]);
    const selfUserList = await parseSuccessBody<Artifact[]>(
      await outsiderFetch(get(`/api/v1/user/${outsider.id}/artifacts`)),
    );
    expect(selfUserList.data.map((a) => a.id)).toContain(userPriv.id);
  });

  it('owners can pin external readable artifacts at root, list placements, and remove root pins', async () => {
    const pubOrg = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'public-handbook', access: 'public' },
    );
    const privOrg = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'secret-doc', access: 'private' },
    );
    const ownPersonal = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'my-folder',
    });

    // Cannot pin own artifact at root (422) or unreadable external artifact (403)
    expect(
      (await outsiderFetch(post('/api/v1/me/artifactPlacements', { artifactId: ownPersonal.id })))
        .status,
    ).toBe(422);
    expect(
      (await outsiderFetch(post('/api/v1/me/artifactPlacements', { artifactId: privOrg.id })))
        .status,
    ).toBe(403);

    // Pinning external public artifact at root succeeds; duplicate returns 409
    const pinResp = await outsiderFetch(
      post('/api/v1/me/artifactPlacements', { artifactId: pubOrg.id }),
    );
    expect(pinResp.status).toBe(201);
    const pin = (await parseSuccessBody<ArtifactPlacement>(pinResp)).data;
    expect(pin.containerArtifactId).toBeNull();
    expect(pin.ownerModel).toBe('User');
    expect(
      (await outsiderFetch(post('/api/v1/me/artifactPlacements', { artifactId: pubOrg.id })))
        .status,
    ).toBe(409);

    // Also place into a personal folder and verify GET /me/artifactPlacements returns both
    expect((await place(outsiderFetch, pubOrg, ownPersonal)).status).toBe(201);
    const listed = await parseSuccessBody<
      (ArtifactPlacement & { artifact: Artifact; containerArtifact: Artifact | null })[]
    >(await outsiderFetch(get('/api/v1/me/artifactPlacements')));
    expect(listed.data).toHaveLength(2);
    expect(listed.data.some((p) => p.id === pin.id && p.containerArtifact === null)).toBe(true);
    expect(
      listed.data.some(
        (p) => p.containerArtifact?.id === ownPersonal.id && p.artifact.id === pubOrg.id,
      ),
    ).toBe(true);

    // Peer/admin cannot read another member's organizationUser/artifactPlacements
    expect(
      (await adminFetch(get(`/api/v1/organizationUser/${memberMembership.id}/artifactPlacements`)))
        .status,
    ).toBe(403);
    expect(
      (await memberFetch(get(`/api/v1/organizationUser/${memberMembership.id}/artifactPlacements`)))
        .status,
    ).toBe(200);

    // Unpinning root placement works via DELETE /artifactPlacement/:id (and refuses strangers)
    expect((await adminFetch(del(`/api/v1/artifactPlacement/${pin.id}`))).status).toBe(403);
    expect((await outsiderFetch(del(`/api/v1/artifactPlacement/${pin.id}`))).status).toBe(204);

    // Regression: placements relation is rejected by artifactListFilterLens (no cross-tenant pin oracle)
    expect(
      (
        await outsiderFetch(
          get(
            `/api/v1/organization/${organization.id}/artifacts?searchFields[placements][some][userId][startsWith]=0`,
          ),
        )
      ).status,
    ).toBe(400);

    // Regression: expired grant is excluded in SQL so pagination.total stays 0 (no post-expiry count oracle)
    const expDoc = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'expired-secret-report', access: 'private' },
    );
    await createArtifactPermission({
      artifactId: expDoc.id,
      granteeModel: 'User',
      granteeUserId: member.id,
      role: 'viewer',
      expiresAt: new Date(Date.now() - 60_000),
    });
    const afterExpiry = await parseSuccessBody<Artifact[]>(
      await memberFetch(
        get(`/api/v1/organization/${organization.id}/artifacts?search=expired-secret-report`),
      ),
    );
    expect(afterExpiry.data).toEqual([]);
    expect(afterExpiry.pagination?.total).toBe(0);

    // Regression: demoted viewer member can still delete their own OrganizationUser root pin
    const memberPinResp = await memberFetch(
      post(`/api/v1/organizationUser/${memberMembership.id}/artifactPlacements`, {
        artifactId: pubOrg.id,
      }),
    );
    expect(memberPinResp.status).toBe(201);
    const memberPin = (await parseSuccessBody<ArtifactPlacement>(memberPinResp)).data;
    const demotedSeat = await db.organizationUser.update({
      where: { id: memberMembership.id },
      data: { role: 'viewer' },
    });
    const demotedFetch = createTestApp({
      mockUser: member,
      mockOrganizationUsers: [demotedSeat],
      mount,
    }).fetch;
    // Viewer cannot pin a new artifact at their OrganizationUser root (403 even on own org artifact)
    expect(
      (
        await demotedFetch(
          post(`/api/v1/organizationUser/${memberMembership.id}/artifactPlacements`, {
            artifactId: ownPersonal.id,
          }),
        )
      ).status,
    ).toBe(403);
    // Viewer CAN remove their existing root pin (no permanent orphan)
    expect((await demotedFetch(del(`/api/v1/artifactPlacement/${memberPin.id}`))).status).toBe(204);

    // Regression: entitlement-only token without ArtifactPlacement:read gets 0 placements (total = 0),
    // while a full: true Organization token sees the org's placements and private org artifacts.
    const externalPub = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'external-pub-ref',
      access: 'public',
    });
    expect(
      (
        await adminFetch(
          post(`/api/v1/organization/${organization.id}/artifactPlacements`, {
            artifactId: externalPub.id,
          }),
        )
      ).status,
    ).toBe(201);
    const { entity: narrowToken } = await createToken({
      ownerModel: 'Organization',
      organizationId: organization.id,
      role: null,
      full: false,
      entitlements: [
        {
          sourceModel: 'Organization',
          sourceId: organization.id,
          resource: 'Organization',
          actions: ['read'],
        },
      ],
    });
    const narrowFetch = createTestApp({
      mockToken: {
        ...narrowToken,
        targetEntitlements: await db.entitlement.findMany({
          where: { targetModel: 'Token', targetTokenId: narrowToken.id },
        }),
        user: null,
        organization,
        organizationUser: null,
        space: null,
        spaceUser: null,
        integration: null,
      },
      mount,
    }).fetch;
    const narrowPlacements = await parseSuccessBody<ArtifactPlacement[]>(
      await narrowFetch(get(`/api/v1/organization/${organization.id}/artifactPlacements`)),
    );
    expect(narrowPlacements.data).toEqual([]);
    expect(narrowPlacements.pagination?.total).toBe(0);

    const { entity: fullUserToken } = await createToken({
      ownerModel: 'User',
      userId: admin.id,
      role: null,
      full: true,
    });
    const fullUserFetch = createTestApp({
      mockOrganizationUsers: [adminMembership],
      mockToken: {
        ...fullUserToken,
        targetEntitlements: [],
        user: admin,
        organization: null,
        organizationUser: null,
        space: null,
        spaceUser: null,
        integration: null,
      },
      mount,
    }).fetch;
    const fullUserPlacements = await parseSuccessBody<ArtifactPlacement[]>(
      await fullUserFetch(get(`/api/v1/organization/${organization.id}/artifactPlacements`)),
    );
    expect(fullUserPlacements.data.some((p) => p.artifactId === externalPub.id)).toBe(true);
  });
});
