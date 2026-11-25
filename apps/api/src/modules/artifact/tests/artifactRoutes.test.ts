import { beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type {
  Artifact,
  ArtifactPlacement,
  Organization,
  OrganizationUser,
  User,
} from '@template/db/generated/client/client';
import { ArtifactKind } from '@template/db/generated/client/enums';
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
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
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
    app.use('*', auditActorMiddleware);
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

  const place = (
    fetch: Fetch,
    artifact: Artifact,
    container: Artifact,
    extra: Record<string, unknown> = {},
  ) =>
    fetch(
      post(`/api/v1/artifact/${artifact.id}/artifactPlacements`, {
        containerArtifactId: container.id,
        ...extra,
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

  it('organization root creation requires manage and creates a private root placement', async () => {
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
    expect(created.effectiveAccess).toBe('private');
    const detail = await adminFetch(get(`/api/v1/artifact/${created.id}`));
    const parsed = (
      await parseSuccessBody<{
        effectiveRole: string | null;
        effectiveAccess: string;
        placements: ArtifactPlacement[];
      }>(detail)
    ).data;
    expect(parsed.effectiveRole).toBe('admin');
    expect(parsed.effectiveAccess).toBe('private');
    expect(parsed.placements).toHaveLength(1);
    expect(parsed.placements[0]!.access).toBe('private');
  });

  it('creating inside a container defaults placement access to inherit; root rejects inherit', async () => {
    const inside = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { containerArtifactId: shared.id },
    );
    const placement = await db.artifactPlacement.findFirstOrThrow({
      where: { artifactId: inside.id, containerArtifactId: shared.id },
    });
    expect(placement.access).toBe('inherit');

    expect(
      (
        await adminFetch(
          post(`/api/v1/organization/${organization.id}/artifacts`, {
            kind: 'folder',
            name: 'bad-root',
            access: 'inherit',
          }),
        )
      ).status,
    ).toBe(422);
  });

  it('an edge needs manage on the artifact and operate on the container', async () => {
    const edge = await placeDraftsInShared();
    expect(edge.access).toBe('inherit');
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
      (await parseSuccessBody<{ effectiveRole: string | null }>(detail)).data.effectiveRole,
    ).toBe('viewer');
    expect((await place(tokenFetch, personalOwned, shared)).status).toBe(403);
    expect((await tokenFetch(get(`/api/v1/artifact/${drafts.id}`))).status).toBe(403);
  });

  it('placing a private item inside a private folder keeps effectiveAccess private even when also placed privately in a public folder', async () => {
    const group = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { access: 'public' },
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
    expect(after.effectiveAccess).toBe('private');
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

  it('refuses a same-owner edge or placement visibility update when the caller lacks manage on the artifact', async () => {
    // member has operate (member) on shared and admin (manage) on drafts -> cannot place shared into drafts
    expect((await place(memberFetch, shared, drafts)).status).toBe(403);

    // Privilege escalation regression: member has viewer on secretDoc and admin on drafts -> cannot place or PATCH secretDoc in drafts
    const secretDoc = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'payroll', access: 'private' },
    );
    await adminFetch(
      post(`/api/v1/artifact/${secretDoc.id}/artifactPermissions`, {
        granteeModel: 'User',
        granteeUserId: member.id,
        role: 'viewer',
      }),
    );
    expect((await place(memberFetch, secretDoc, drafts, { access: 'public' })).status).toBe(403);
    const adminEdge = (
      await parseSuccessBody<ArtifactPlacement>(
        await place(adminFetch, secretDoc, drafts, { access: 'private' }),
      )
    ).data;
    expect(
      (await memberFetch(patch(`/api/v1/artifactPlacement/${adminEdge.id}`, { access: 'public' })))
        .status,
    ).toBe(403);
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
      (await parseSuccessBody<{ effectiveRole: string | null }>(tokenDetail)).data.effectiveRole,
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
    const grant = await parseSuccessBody<{ id: string }>(
      await outsiderFetch(
        post(`/api/v1/artifact/${personal.id}/artifactPermissions`, {
          granteeModel: 'User',
          granteeUserId: admin.id,
          role: 'viewer',
        }),
      ),
    );
    const placed = await place(adminFetch, personal, orgPublic);
    expect(placed.status).toBe(201);
    const edgeId = (await parseSuccessBody<{ id: string }>(placed)).data.id;
    expect((await memberFetch(get(`/api/v1/artifact/${personal.id}`))).status).toBe(403);
    const after = await db.artifact.findUniqueOrThrow({ where: { id: personal.id } });
    expect(after.effectiveAccess).toBe('private');
    expect((await outsiderFetch(del(`/api/v1/artifactPermission/${grant.data.id}`))).status).toBe(
      204,
    );
    expect((await adminFetch(get(`/api/v1/artifact/${personal.id}`))).status).toBe(403);
    expect((await adminFetch(del(`/api/v1/artifactPlacement/${edgeId}`))).status).toBe(204);
  });

  it('cross-owner placements do not defeat private placement inside a public folder', async () => {
    const aliceFolder = await createFolder(outsiderFetch, '/api/v1/me/artifacts');
    const alicePublic = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      access: 'public',
    });
    const aliceFile = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      containerArtifactId: aliceFolder.id,
    });
    const edgeInFolder = await db.artifactPlacement.findFirstOrThrow({
      where: { artifactId: aliceFile.id, containerArtifactId: aliceFolder.id },
    });
    expect(edgeInFolder.access).toBe('inherit');

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

    // Move out of aliceFolder -> back to alice's root
    expect(
      (
        await outsiderFetch(
          post(`/api/v1/artifact/${aliceFile.id}/move`, {
            fromContainerArtifactId: aliceFolder.id,
          }),
        )
      ).status,
    ).toBe(200);
    const rootPlacements = await parseSuccessBody<ArtifactPlacement[]>(
      await outsiderFetch(get('/api/v1/me/artifactPlacements')),
    );
    expect(rootPlacements.data.map((p) => p.artifactId)).toContain(aliceFile.id);

    // Placing into alicePublic with explicit access: 'private' keeps effectiveAccess private
    expect((await place(outsiderFetch, aliceFile, alicePublic, { access: 'private' })).status).toBe(
      201,
    );
    const after = await db.artifact.findUniqueOrThrow({ where: { id: aliceFile.id } });
    expect(after.effectiveAccess).toBe('private');
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

  it('GET /artifact/:id reports effectiveRole as null for strangers on public artifacts and scalar effectiveAccess as public', async () => {
    const pub = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { access: 'public' },
    );
    const asOutsider = await parseSuccessBody<{
      effectiveRole: string | null;
      effectiveAccess: string;
    }>(await outsiderFetch(get(`/api/v1/artifact/${pub.id}`)));
    expect(asOutsider.data.effectiveRole).toBeNull();
    expect(asOutsider.data.effectiveAccess).toBe('public');

    const asAdmin = await parseSuccessBody<{
      effectiveRole: string | null;
      effectiveAccess: string;
    }>(await adminFetch(get(`/api/v1/artifact/${pub.id}`)));
    expect(asAdmin.data.effectiveRole).toBe('admin');
    expect(asAdmin.data.effectiveAccess).toBe('public');
  });

  it('PATCH /artifact/:id lets operate rename; PATCH /artifactPlacement/:id requires manage to change access', async () => {
    expect(
      (await memberFetch(patch(`/api/v1/artifact/${shared.id}`, { name: 'renamed' }))).status,
    ).toBe(200);
    const sharedRootEdge = await db.artifactPlacement.findFirstOrThrow({
      where: { artifactId: shared.id },
    });
    expect(
      (
        await memberFetch(
          patch(`/api/v1/artifactPlacement/${sharedRootEdge.id}`, { access: 'public' }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await adminFetch(
          patch(`/api/v1/artifactPlacement/${sharedRootEdge.id}`, { access: 'public' }),
        )
      ).status,
    ).toBe(200);
    expect(
      (await db.artifact.findUniqueOrThrow({ where: { id: shared.id } })).effectiveAccess,
    ).toBe('public');
    // Root placement rejects inherit
    expect(
      (
        await adminFetch(
          patch(`/api/v1/artifactPlacement/${sharedRootEdge.id}`, { access: 'inherit' }),
        )
      ).status,
    ).toBe(422);
  });

  it('root container cannot be deleted, updated, moved, copied, placed, or granted permissions', async () => {
    const orgRoot = await db.artifact.findFirstOrThrow({
      where: {
        ownerModel: 'Organization',
        organizationId: organization.id,
        kind: ArtifactKind.root,
      },
    });
    const ownerSeat = await createOrganizationUser({ role: 'owner' }, { organization });
    const ownerFetch = createTestApp({
      mockUser: ownerSeat.context.user,
      mockOrganizationUsers: [ownerSeat.entity],
      mount,
    }).fetch;

    expect((await ownerFetch(del(`/api/v1/artifact/${orgRoot.id}`))).status).toBe(422);
    expect(
      (await ownerFetch(patch(`/api/v1/artifact/${orgRoot.id}`, { name: 'nope' }))).status,
    ).toBe(422);
    expect(
      (
        await ownerFetch(
          post(`/api/v1/artifact/${orgRoot.id}/move`, { toContainerArtifactId: shared.id }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await ownerFetch(
          post(`/api/v1/artifact/${orgRoot.id}/copy`, { containerArtifactId: shared.id }),
        )
      ).status,
    ).toBe(422);
    expect((await place(ownerFetch, orgRoot, shared)).status).toBe(422);
    expect(
      (
        await ownerFetch(
          post(`/api/v1/artifact/${orgRoot.id}/artifactPermissions`, {
            granteeModel: 'User',
            granteeUserId: member.id,
            role: 'viewer',
          }),
        )
      ).status,
    ).toBe(422);
  });

  it('lists only the children the caller can read on GET /artifact/:id', async () => {
    await placeDraftsInShared();
    const hidden = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
    );
    await place(adminFetch, hidden, shared, { access: 'private' });

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

  it('removing from a folder needs both sides and returns the artifact to its owner root', async () => {
    const stranger = (await createUser()).entity;
    const strangerFetch = createTestApp({ mockUser: stranger, mount }).fetch;
    const edge = await placeDraftsInShared();
    expect((await strangerFetch(del(`/api/v1/artifactPlacement/${edge.id}`))).status).toBe(403);
    expect((await memberFetch(del(`/api/v1/artifactPlacement/${edge.id}`))).status).toBe(204);
    const flat = await parseSuccessBody<Artifact[]>(
      await memberFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
    );
    expect(flat.data.map((artifact) => artifact.id)).toContain(drafts.id);
  });

  it('organizationUser/artifactPermissions stays private to the member; child permissions never shift across filtered neighbors; deletedAt filter is rejected', async () => {
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

    // Post-filter index shift regression: [unreadable, manageable, viewerOnly]
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
    expect((await place(adminFetch, unreadable, shared, { access: 'private' })).status).toBe(201);
    for (const child of [manageable, viewerOnly]) {
      expect((await place(adminFetch, child, shared, { access: 'inherit' })).status).toBe(201);
    }
    const detail = await parseSuccessBody<{
      children: (Artifact & { permissions: unknown[] })[];
    }>(await memberFetch(get(`/api/v1/artifact/${shared.id}`)));
    const byId = new Map(detail.data.children.map((child) => [child.id, child]));
    expect(byId.has(unreadable.id)).toBe(false);
    expect(byId.get(manageable.id)!.permissions.length).toBeGreaterThan(0);
    expect(byId.get(viewerOnly.id)!.permissions).toEqual([]);

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

  it('waifu test & public reshare: external public artifacts placed at root default to private, toggle to public/tenant, and auto-hide if source turns private', async () => {
    const anonFetch = createTestApp({ mount }).fetch;
    const waifu = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'waifu-pic', access: 'public' },
    );
    const essay = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'cool-essay', access: 'public' },
    );
    const privOrg = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'secret-doc', access: 'private' },
    );

    // Cannot place unreadable external artifact at root (403)
    expect(
      (
        await outsiderFetch(
          post(`/api/v1/artifact/${privOrg.id}/artifactPlacements`, {
            ownerModel: 'User',
            userId: outsider.id,
          }),
        )
      ).status,
    ).toBe(403);

    // Pinning waifu at outsider's root defaults to private -> invisible to strangers!
    const waifuPinResp = await outsiderFetch(
      post(`/api/v1/artifact/${waifu.id}/artifactPlacements`, {
        ownerModel: 'User',
        userId: outsider.id,
      }),
    );
    expect(waifuPinResp.status).toBe(201);
    const waifuPin = (await parseSuccessBody<ArtifactPlacement>(waifuPinResp)).data;
    expect(waifuPin.access).toBe('private');
    // Duplicate root pin returns 409
    expect(
      (
        await outsiderFetch(
          post(`/api/v1/artifact/${waifu.id}/artifactPlacements`, {
            ownerModel: 'User',
            userId: outsider.id,
          }),
        )
      ).status,
    ).toBe(409);

    // Resharing essay publicly at outsider's root -> visible to anonymous strangers!
    const essayPinResp = await outsiderFetch(
      post(`/api/v1/artifact/${essay.id}/artifactPlacements`, {
        ownerModel: 'User',
        userId: outsider.id,
        access: 'public',
      }),
    );
    expect(essayPinResp.status).toBe(201);

    const anonOutsiderRoot = await parseSuccessBody<(ArtifactPlacement & { artifact: Artifact })[]>(
      await anonFetch(get(`/api/v1/user/${outsider.id}/artifactPlacements`)),
    );
    expect(anonOutsiderRoot.data.map((p) => p.artifactId)).toEqual([essay.id]);

    // Outsider themselves sees BOTH waifu and essay at their root
    const selfRoot = await parseSuccessBody<ArtifactPlacement[]>(
      await outsiderFetch(get('/api/v1/me/artifactPlacements')),
    );
    expect(selfRoot.data.map((p) => p.artifactId).sort()).toEqual([essay.id, waifu.id].sort());

    // If org turns essay back to private, it immediately disappears from outsider's public root
    const essayOrgEdge = await db.artifactPlacement.findFirstOrThrow({
      where: { artifactId: essay.id, containerArtifact: { organizationId: organization.id } },
    });
    expect(
      (
        await adminFetch(
          patch(`/api/v1/artifactPlacement/${essayOrgEdge.id}`, { access: 'private' }),
        )
      ).status,
    ).toBe(200);
    const anonAfterPrivate = await parseSuccessBody<ArtifactPlacement[]>(
      await anonFetch(get(`/api/v1/user/${outsider.id}/artifactPlacements`)),
    );
    expect(anonAfterPrivate.data).toEqual([]);

    // Org bookmark at org root with access: 'tenant' -> coworkers see it, strangers don't; AuditLog carries Org's tenant context
    const externalPub = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'external-pub-ref',
      access: 'public',
    });
    const orgTenantPin = (
      await parseSuccessBody<ArtifactPlacement>(
        await adminFetch(
          post(`/api/v1/artifact/${externalPub.id}/artifactPlacements`, {
            ownerModel: 'Organization',
            organizationId: organization.id,
            access: 'tenant',
          }),
        ),
      )
    ).data;
    const auditRows = await db.auditLog.findMany({
      where: { subjectArtifactPlacementId: orgTenantPin.id },
    });
    expect(auditRows.length).toBeGreaterThan(0);
    expect(auditRows[0]!.contextOrganizationId).toBe(organization.id);

    const memberOrgRoot = await parseSuccessBody<ArtifactPlacement[]>(
      await memberFetch(get(`/api/v1/organization/${organization.id}/artifactPlacements`)),
    );
    expect(memberOrgRoot.data.map((p) => p.artifactId)).toContain(externalPub.id);
    const anonOrgRoot = await parseSuccessBody<ArtifactPlacement[]>(
      await anonFetch(get(`/api/v1/organization/${organization.id}/artifactPlacements`)),
    );
    expect(anonOrgRoot.data.map((p) => p.artifactId)).not.toContain(externalPub.id);

    // Private placement of public waifu inside a public folder stays hidden from strangers on GET /artifact/:publicFolderId
    const pubFolder = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'public-showcase',
      access: 'public',
    });
    expect((await place(outsiderFetch, waifu, pubFolder, { access: 'private' })).status).toBe(201);
    const showcaseAnon = await parseSuccessBody<{ children: Artifact[] }>(
      await anonFetch(get(`/api/v1/artifact/${pubFolder.id}`)),
    );
    expect(showcaseAnon.data.children.map((c) => c.id)).not.toContain(waifu.id);
    const showcaseOwner = await parseSuccessBody<{ children: Artifact[] }>(
      await outsiderFetch(get(`/api/v1/artifact/${pubFolder.id}`)),
    );
    expect(showcaseOwner.data.children.map((c) => c.id)).toContain(waifu.id);

    // Unpinning root placement works via DELETE /artifactPlacement/:id (and refuses strangers)
    expect((await adminFetch(del(`/api/v1/artifactPlacement/${waifuPin.id}`))).status).toBe(403);
    expect((await outsiderFetch(del(`/api/v1/artifactPlacement/${waifuPin.id}`))).status).toBe(204);

    // Regression: placements relation is rejected by artifactListFilterLens (no cross-tenant pin oracle)
    expect(
      (
        await outsiderFetch(
          get(
            `/api/v1/organization/${organization.id}/artifacts?searchFields[placements][some][id][startsWith]=0`,
          ),
        )
      ).status,
    ).toBe(400);

    // Regression: expired grant is excluded in SQL so pagination.total stays 0
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

    // Regression: demoted viewer member cannot pin new artifact at OrganizationUser root (403) but CAN delete existing pin (204)
    const memberPinResp = await memberFetch(
      post(`/api/v1/artifact/${waifu.id}/artifactPlacements`, {
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: member.id,
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
    expect(
      (
        await demotedFetch(
          post(`/api/v1/artifact/${externalPub.id}/artifactPlacements`, {
            ownerModel: 'OrganizationUser',
            organizationId: organization.id,
            userId: member.id,
          }),
        )
      ).status,
    ).toBe(403);
    expect((await demotedFetch(del(`/api/v1/artifactPlacement/${memberPin.id}`))).status).toBe(204);

    // Regression: entitlement-only token without ArtifactPlacement:read gets 0 placements (total = 0),
    // while a full: true User token sees the org's placements
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

  it('adversarial regressions: non-default access requires manage, filtered placement total hides private pins, operate cannot touch private placements, demoted rootId/copy blocked, tenantPermissionRules skip private root pins, no orphans, extra FKs rejected, exclusive is same-owner only', async () => {
    const anonFetch = createTestApp({ mount }).fetch;

    // 1. operate-only on container cannot set non-default access via place/move; member User token cannot publish public root
    expect((await place(memberFetch, drafts, shared, { access: 'public' })).status).toBe(403);
    expect(
      (
        await memberFetch(
          post(`/api/v1/artifact/${drafts.id}/move`, {
            toContainerArtifactId: shared.id,
            access: 'public',
          }),
        )
      ).status,
    ).toBe(403);

    const { entity: memberUserToken } = await createToken({
      ownerModel: 'User',
      userId: outsider.id,
      role: 'member',
    });
    const memberUserTokenFetch = createTestApp({
      mockUser: outsider,
      mockToken: {
        ...memberUserToken,
        targetEntitlements: [],
        user: outsider,
        organization: null,
        organizationUser: null,
        space: null,
        spaceUser: null,
        integration: null,
      },
      mount,
    }).fetch;
    expect(
      (
        await memberUserTokenFetch(
          post('/api/v1/me/artifacts', { kind: 'folder', name: 'nope-pub', access: 'public' }),
        )
      ).status,
    ).toBe(403);
    const pubOrgDoc = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'org-pub-doc', access: 'public' },
    );
    expect(
      (
        await memberUserTokenFetch(
          post(`/api/v1/artifact/${pubOrgDoc.id}/artifactPlacements`, {
            ownerModel: 'User',
            userId: outsider.id,
            access: 'public',
          }),
        )
      ).status,
    ).toBe(403);

    // 2. Filtered placement query pagination.total never leaks hidden private placement inside public folder,
    // and explicit containerArtifact[kind]=root still returns public root reshares anonymously
    const pubFolder = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'pub-folder',
      access: 'public',
    });
    const privatePinInPub = (
      await parseSuccessBody<ArtifactPlacement>(
        await place(outsiderFetch, pubOrgDoc, pubFolder, { access: 'private' }),
      )
    ).data;
    expect(privatePinInPub.access).toBe('private');
    const anonFiltered = await parseSuccessBody<ArtifactPlacement[]>(
      await anonFetch(
        get(
          `/api/v1/user/${outsider.id}/artifactPlacements?searchFields[containerArtifactId]=${pubFolder.id}&searchFields[artifactId]=${pubOrgDoc.id}`,
        ),
      ),
    );
    expect(anonFiltered.data).toEqual([]);
    expect(anonFiltered.pagination?.total).toBe(0);
    const anonExplicitRoot = await parseSuccessBody<ArtifactPlacement[]>(
      await anonFetch(
        get(
          `/api/v1/user/${outsider.id}/artifactPlacements?searchFields[containerArtifact][kind]=root`,
        ),
      ),
    );
    expect(anonExplicitRoot.data.map((p) => p.artifactId)).toContain(pubFolder.id);

    // 3. operate-only member on shared cannot delete or move a hidden private placement inside shared
    const hiddenPinInShared = (
      await parseSuccessBody<ArtifactPlacement>(
        await place(adminFetch, pubFolder, shared, { access: 'private' }),
      )
    ).data;
    expect(
      (await memberFetch(del(`/api/v1/artifactPlacement/${hiddenPinInShared.id}`))).status,
    ).toBe(403);
    expect(
      (
        await memberFetch(
          post(`/api/v1/artifact/${pubFolder.id}/move`, {
            fromContainerArtifactId: shared.id,
            toContainerArtifactId: drafts.id,
          }),
        )
      ).status,
    ).toBe(403);

    // 4. Demoted OrganizationUser viewer passing containerArtifactId = orgUserRoot.id or copy is rejected (403)
    const memberOwned = await createFolder(
      memberFetch,
      `/api/v1/organizationUser/${memberMembership.id}/artifacts`,
      { name: 'member-folder' },
    );
    const memberRoot = await db.artifact.findFirstOrThrow({
      where: {
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: member.id,
        kind: ArtifactKind.root,
      },
    });
    const demotedSeat = await db.organizationUser.update({
      where: { id: memberMembership.id },
      data: { role: 'viewer' },
    });
    const demotedFetch = createTestApp({
      mockUser: member,
      mockOrganizationUsers: [demotedSeat],
      mount,
    }).fetch;
    expect((await place(demotedFetch, pubFolder, memberRoot)).status).toBe(403);
    expect(
      (
        await demotedFetch(
          post(`/api/v1/artifact/${pubFolder.id}/copy`, { containerArtifactId: memberOwned.id }),
        )
      ).status,
    ).toBe(403);
    await db.organizationUser.update({
      where: { id: memberMembership.id },
      data: { role: 'member' },
    });

    // 5. tenantPermissionRules on db:Artifact.read does NOT expose private root placements to org members
    const orgPrivateWaifu = (
      await parseSuccessBody<ArtifactPlacement>(
        await adminFetch(
          post(`/api/v1/artifact/${pubFolder.id}/artifactPlacements`, {
            ownerModel: 'Organization',
            organizationId: organization.id,
            access: 'private',
          }),
        ),
      )
    ).data;
    await db.organization.update({
      where: { id: organization.id },
      data: {
        tenantPermissionRules: {
          'db:Artifact': { read: { rel: 'organization', action: 'read' } },
        },
      },
    });
    const memberRootAfterRule = await parseSuccessBody<ArtifactPlacement[]>(
      await memberFetch(get(`/api/v1/organization/${organization.id}/artifactPlacements`)),
    );
    expect(memberRootAfterRule.data.map((p) => p.id)).not.toContain(orgPrivateWaifu.id);

    // 6. No orphans: cannot delete sole same-owner root placement, move out to cross-owner, or create in foreign container
    const soleRootEdge = await db.artifactPlacement.findFirstOrThrow({
      where: { artifactId: pubOrgDoc.id, containerArtifact: { kind: ArtifactKind.root } },
    });
    expect((await adminFetch(del(`/api/v1/artifactPlacement/${soleRootEdge.id}`))).status).toBe(
      422,
    );
    expect(
      (
        await outsiderFetch(
          post('/api/v1/me/artifacts', {
            kind: 'folder',
            name: 'cross-owner-create',
            containerArtifactId: shared.id,
          }),
        )
      ).status,
    ).toBe(403);
    const adminPersonal = await createFolder(adminFetch, '/api/v1/me/artifacts', {
      name: 'admin-personal',
    });
    expect(
      (
        await adminFetch(
          post('/api/v1/me/artifacts', {
            kind: 'folder',
            name: 'cross-owner-create',
            containerArtifactId: shared.id,
          }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await adminFetch(
          post(`/api/v1/artifact/${adminPersonal.id}/move`, {
            toContainerArtifactId: shared.id,
          }),
        )
      ).status,
    ).toBe(422);

    // 7. Extra owner FK columns are rejected with 422
    expect(
      (
        await outsiderFetch(
          post(`/api/v1/artifact/${pubOrgDoc.id}/artifactPlacements`, {
            ownerModel: 'User',
            userId: outsider.id,
            organizationId: organization.id,
          }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await outsiderFetch(
          post(`/api/v1/artifact/${pubOrgDoc.id}/artifactPlacements`, {
            containerArtifactId: pubFolder.id,
            userId: outsider.id,
          }),
        )
      ).status,
    ).toBe(422);

    // 8. Cross-owner private pin does NOT flip exclusive to false on owner's folder detail
    const ownedChild = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'owned-child',
      containerArtifactId: pubFolder.id,
    });
    expect((await place(adminFetch, ownedChild, shared, { access: 'private' })).status).toBe(201);
    const pubFolderDetail = await parseSuccessBody<{
      children: (Artifact & { exclusive: boolean })[];
    }>(await outsiderFetch(get(`/api/v1/artifact/${pubFolder.id}`)));
    const childRow = pubFolderDetail.data.children.find((c) => c.id === ownedChild.id);
    expect(childRow?.exclusive).toBe(true);
  });
});
