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
    expect(created.effectiveReadAccess).toBe('private');
    expect(created.effectiveOperateAccess).toBe('private');
    const detail = await adminFetch(get(`/api/v1/artifact/${created.id}`));
    const parsed = (
      await parseSuccessBody<{
        effectiveRole: string | null;
        effectiveReadAccess: string;
        effectiveOperateAccess: string;
        artifactPlacementsAsArtifact: ArtifactPlacement[];
      }>(detail)
    ).data;
    expect(parsed.effectiveRole).toBe('admin');
    expect(parsed.effectiveReadAccess).toBe('private');
    expect(parsed.effectiveOperateAccess).toBe('private');
    expect(parsed.artifactPlacementsAsArtifact).toHaveLength(1);
    expect(parsed.artifactPlacementsAsArtifact[0]!.readAccess).toBe('private');
    expect(parsed.artifactPlacementsAsArtifact[0]!.operateAccess).toBe('private');
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
    expect(placement.readAccess).toBe('inherit');
    expect(placement.operateAccess).toBe('inherit');

    expect(
      (
        await adminFetch(
          post(`/api/v1/organization/${organization.id}/artifacts`, {
            kind: 'folder',
            name: 'bad-root',
            readAccess: 'inherit',
          }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await adminFetch(
          post(`/api/v1/organization/${organization.id}/artifacts`, {
            kind: 'folder',
            name: 'bad-root-op',
            operateAccess: 'inherit',
          }),
        )
      ).status,
    ).toBe(422);
  });

  it('an edge needs manage on the artifact and operate on the container', async () => {
    const edge = await placeDraftsInShared();
    expect(edge.readAccess).toBe('inherit');
    expect(edge.operateAccess).toBe('inherit');
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

  it('placing a private item inside a private folder keeps effectiveReadAccess private even when also placed privately in a public folder', async () => {
    const group = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { readAccess: 'public' },
    );
    const secret = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      {
        containerArtifactId: group.id,
        readAccess: 'private',
      },
    );
    const other = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
    );
    expect((await place(adminFetch, secret, other)).status).toBe(201);
    const after = await db.artifact.findUniqueOrThrow({ where: { id: secret.id } });
    expect(after.effectiveReadAccess).toBe('private');
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
      { name: 'payroll', readAccess: 'private' },
    );
    await adminFetch(
      post(`/api/v1/artifact/${secretDoc.id}/artifactPermissions`, {
        granteeModel: 'User',
        granteeUserId: member.id,
        role: 'viewer',
      }),
    );
    expect((await place(memberFetch, secretDoc, drafts, { readAccess: 'public' })).status).toBe(
      403,
    );
    const adminEdge = (
      await parseSuccessBody<ArtifactPlacement>(
        await place(adminFetch, secretDoc, drafts, { readAccess: 'private' }),
      )
    ).data;
    expect(
      (
        await memberFetch(
          patch(`/api/v1/artifactPlacement/${adminEdge.id}`, { readAccess: 'public' }),
        )
      ).status,
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
    const sub = await chain(21);
    for (let i = 2; i < sub.length; i++) {
      await createArtifactPlacement({
        artifactId: sub[i]!.id,
        containerArtifactId: sub[0]!.id,
      });
    }
    // 30 + 21 = 51 non-root levels (> ARTIFACT_MAX_DEPTH = 50) must be rejected
    expect((await place(adminFetch, sub[0]!, top[top.length - 1]!)).status).toBe(422);
    // 30 + 20 = 50 non-root levels (== ARTIFACT_MAX_DEPTH) succeeds
    expect((await place(adminFetch, sub[1]!, top[top.length - 1]!)).status).toBe(201);
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
      { readAccess: 'public' },
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
    expect(after.effectiveReadAccess).toBe('private');
    expect((await outsiderFetch(del(`/api/v1/artifactPermission/${grant.data.id}`))).status).toBe(
      204,
    );
    expect((await adminFetch(get(`/api/v1/artifact/${personal.id}`))).status).toBe(403);
    expect((await adminFetch(del(`/api/v1/artifactPlacement/${edgeId}`))).status).toBe(204);
  });

  it('cross-owner placements do not defeat private placement inside a public folder', async () => {
    const aliceFolder = await createFolder(outsiderFetch, '/api/v1/me/artifacts');
    const alicePublic = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      readAccess: 'public',
    });
    const aliceFile = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      containerArtifactId: aliceFolder.id,
    });
    const edgeInFolder = await db.artifactPlacement.findFirstOrThrow({
      where: { artifactId: aliceFile.id, containerArtifactId: aliceFolder.id },
    });
    expect(edgeInFolder.readAccess).toBe('inherit');

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
      { readAccess: 'public' },
    );
    expect((await place(adminFetch, aliceFile, orgPublic)).status).toBe(201);

    // Move placement out of aliceFolder -> back to alice's root
    const aliceFolderEdge = await db.artifactPlacement.findFirstOrThrow({
      where: { artifactId: aliceFile.id, containerArtifactId: aliceFolder.id },
    });
    expect(
      (await outsiderFetch(post(`/api/v1/artifactPlacement/${aliceFolderEdge.id}/move`, {})))
        .status,
    ).toBe(200);
    const rootPlacements = await parseSuccessBody<ArtifactPlacement[]>(
      await outsiderFetch(get('/api/v1/me/artifactPlacements')),
    );
    expect(rootPlacements.data.map((p) => p.artifactId)).toContain(aliceFile.id);

    // Cross-owner placement in orgPublic refuses unauthorized target with 403 (no existence/owner oracle)
    // and can move to org root (sourceContainer owner) when targetContainerArtifactId is omitted
    const orgPublicEdge = await db.artifactPlacement.findFirstOrThrow({
      where: { artifactId: aliceFile.id, containerArtifactId: orgPublic.id },
    });
    expect(
      (
        await adminFetch(
          post(`/api/v1/artifactPlacement/${orgPublicEdge.id}/move`, {
            targetContainerArtifactId: alicePublic.id,
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await adminFetch(
          post(`/api/v1/artifactPlacement/${orgPublicEdge.id}/move`, {
            targetContainerArtifactId: '',
          }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await adminFetch(
          post(`/api/v1/artifact/${aliceFile.id}/copy`, {
            ownerModel: 'User',
            userId: '00000000-0000-7000-8000-000000000000',
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await adminFetch(
          post(`/api/v1/artifact/${aliceFile.id}/copy`, { targetContainerArtifactId: '' }),
        )
      ).status,
    ).toBe(422);
    expect(
      (await adminFetch(post(`/api/v1/artifactPlacement/${orgPublicEdge.id}/move`, {}))).status,
    ).toBe(200);
    const movedOrgPin = await db.artifactPlacement.findUniqueOrThrow({
      where: { id: orgPublicEdge.id },
      include: { containerArtifact: true },
    });
    expect(movedOrgPin.containerArtifact.kind).toBe(ArtifactKind.root);
    expect(movedOrgPin.containerArtifact.ownerModel).toBe('Organization');

    // Placing into alicePublic with explicit readAccess: 'private' keeps effectiveReadAccess private
    expect(
      (await place(outsiderFetch, aliceFile, alicePublic, { readAccess: 'private' })).status,
    ).toBe(201);
    const after = await db.artifact.findUniqueOrThrow({ where: { id: aliceFile.id } });
    expect(after.effectiveReadAccess).toBe('private');
    expect((await memberFetch(get(`/api/v1/artifact/${aliceFile.id}`))).status).toBe(403);
  });

  it('hard-deletes placements (keeping AuditLog) and revives artifacts fresh at root without resurrecting old folder placements', async () => {
    const folder = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'temp-folder',
    });
    const doc = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'revivable-doc',
      containerArtifactId: folder.id,
    });
    const folderEdge = await db.artifactPlacement.findFirstOrThrow({
      where: { artifactId: doc.id, containerArtifactId: folder.id },
    });

    // Soft-deleting doc hard-deletes its placement via HARD_DELETE_ON_TOMBSTONE while keeping its delete AuditLog.
    expect((await outsiderFetch(del(`/api/v1/artifact/${doc.id}`))).status).toBe(204);
    expect(
      await db.withDeleted(() => db.artifactPlacement.findUnique({ where: { id: folderEdge.id } })),
    ).toBeNull();
    const deleteAudit = await db.auditLog.findFirst({
      where: { subjectModel: 'ArtifactPlacement', subjectId: folderEdge.id, action: 'delete' },
    });
    expect(deleteAudit).not.toBeNull();

    // Reviving doc places it fresh at its owner's root (private) and does NOT resurrect folderEdge.
    await db.withDeleted(() =>
      db.artifact.update({ where: { id: doc.id }, data: { deletedAt: null } }),
    );
    const revivedPlacements = await db.artifactPlacement.findMany({
      where: { artifactId: doc.id },
      include: { containerArtifact: true },
    });
    expect(revivedPlacements).toHaveLength(1);
    expect(revivedPlacements[0]!.containerArtifact.kind).toBe(ArtifactKind.root);
    expect(revivedPlacements[0]!.readAccess).toBe('private');
    expect(revivedPlacements[0]!.operateAccess).toBe('private');
  });

  it('GET /artifact/:id reports effectiveRole as null for strangers on public artifacts and scalar effectiveReadAccess as public', async () => {
    const pub = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { readAccess: 'public' },
    );
    const asOutsider = await parseSuccessBody<{
      effectiveRole: string | null;
      effectiveReadAccess: string;
    }>(await outsiderFetch(get(`/api/v1/artifact/${pub.id}`)));
    expect(asOutsider.data.effectiveRole).toBeNull();
    expect(asOutsider.data.effectiveReadAccess).toBe('public');

    const asAdmin = await parseSuccessBody<{
      effectiveRole: string | null;
      effectiveReadAccess: string;
    }>(await adminFetch(get(`/api/v1/artifact/${pub.id}`)));
    expect(asAdmin.data.effectiveRole).toBe('admin');
    expect(asAdmin.data.effectiveReadAccess).toBe('public');
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
          patch(`/api/v1/artifactPlacement/${sharedRootEdge.id}`, { readAccess: 'public' }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await adminFetch(
          patch(`/api/v1/artifactPlacement/${sharedRootEdge.id}`, { readAccess: 'public' }),
        )
      ).status,
    ).toBe(200);
    expect(
      (await db.artifact.findUniqueOrThrow({ where: { id: shared.id } })).effectiveReadAccess,
    ).toBe('public');
    // Root placement rejects inherit
    expect(
      (
        await adminFetch(
          patch(`/api/v1/artifactPlacement/${sharedRootEdge.id}`, { readAccess: 'inherit' }),
        )
      ).status,
    ).toBe(422);
  });

  it('root container cannot be deleted, updated, copied, placed, or granted permissions', async () => {
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
          post(`/api/v1/artifact/${orgRoot.id}/copy`, { targetContainerArtifactId: shared.id }),
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
    await place(adminFetch, hidden, shared, { readAccess: 'private' });

    const asAdmin = await parseSuccessBody<{
      artifactPlacementsAsContainer: { artifact: Artifact }[];
    }>(await adminFetch(get(`/api/v1/artifact/${shared.id}`)));
    expect(asAdmin.data.artifactPlacementsAsContainer.map((p) => p.artifact.id)).toContain(
      hidden.id,
    );
    const asMember = await parseSuccessBody<{
      artifactPlacementsAsContainer: { artifact: Artifact }[];
    }>(await memberFetch(get(`/api/v1/artifact/${shared.id}`)));
    expect(asMember.data.artifactPlacementsAsContainer.map((p) => p.artifact.id)).toContain(
      drafts.id,
    );
    expect(asMember.data.artifactPlacementsAsContainer.map((p) => p.artifact.id)).not.toContain(
      hidden.id,
    );
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
      { name: 'a-unreadable', readAccess: 'private' },
    );
    const manageable = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'b-manageable', readAccess: 'private' },
    );
    const viewerOnly = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'c-viewer', readAccess: 'private' },
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
    expect((await place(adminFetch, unreadable, shared, { readAccess: 'private' })).status).toBe(
      201,
    );
    for (const child of [manageable, viewerOnly]) {
      expect((await place(adminFetch, child, shared, { readAccess: 'inherit' })).status).toBe(201);
    }
    const detail = await parseSuccessBody<{
      artifactPlacementsAsContainer: {
        artifact: Artifact & { artifactPermissions: unknown[] };
      }[];
    }>(await memberFetch(get(`/api/v1/artifact/${shared.id}`)));
    const byId = new Map(
      detail.data.artifactPlacementsAsContainer.map((p) => [p.artifact.id, p.artifact]),
    );
    expect(byId.has(unreadable.id)).toBe(false);
    expect(byId.get(manageable.id)!.artifactPermissions.length).toBeGreaterThan(0);
    expect(byId.get(viewerOnly.id)!.artifactPermissions).toEqual([]);

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
      { name: 'pub-org', readAccess: 'public' },
    );
    const tenantOrg = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'tenant-org', readAccess: 'tenant' },
    );
    const privateOrg = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'private-org', readAccess: 'private' },
    );

    const asAnon = await parseSuccessBody<(Artifact & { artifactPermissions: unknown[] })[]>(
      await anonFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
    );
    expect(asAnon.data.map((a) => a.id)).toEqual([pubOrg.id]);
    expect(asAnon.data[0]!.artifactPermissions).toEqual([]);

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
      readAccess: 'public',
    });
    const userPriv = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'user-priv',
      readAccess: 'private',
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
      { name: 'waifu-pic', readAccess: 'public' },
    );
    const essay = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'cool-essay', readAccess: 'public' },
    );
    const privOrg = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'secret-doc', readAccess: 'private' },
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
    expect(waifuPin.readAccess).toBe('private');
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
        readAccess: 'public',
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
          patch(`/api/v1/artifactPlacement/${essayOrgEdge.id}`, { readAccess: 'private' }),
        )
      ).status,
    ).toBe(200);
    const anonAfterPrivate = await parseSuccessBody<ArtifactPlacement[]>(
      await anonFetch(get(`/api/v1/user/${outsider.id}/artifactPlacements`)),
    );
    expect(anonAfterPrivate.data).toEqual([]);

    // Org bookmark at org root with readAccess: 'tenant' -> coworkers see it, strangers don't; AuditLog carries Org's tenant context
    const externalPub = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'external-pub-ref',
      readAccess: 'public',
    });
    const orgTenantPin = (
      await parseSuccessBody<ArtifactPlacement>(
        await adminFetch(
          post(`/api/v1/artifact/${externalPub.id}/artifactPlacements`, {
            ownerModel: 'Organization',
            organizationId: organization.id,
            readAccess: 'tenant',
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
      readAccess: 'public',
    });
    expect((await place(outsiderFetch, waifu, pubFolder, { readAccess: 'private' })).status).toBe(
      201,
    );
    const showcaseAnon = await parseSuccessBody<{
      artifactPlacementsAsContainer: { artifact: Artifact }[];
    }>(await anonFetch(get(`/api/v1/artifact/${pubFolder.id}`)));
    expect(showcaseAnon.data.artifactPlacementsAsContainer.map((p) => p.artifact.id)).not.toContain(
      waifu.id,
    );
    const showcaseOwner = await parseSuccessBody<{
      artifactPlacementsAsContainer: { artifact: Artifact }[];
    }>(await outsiderFetch(get(`/api/v1/artifact/${pubFolder.id}`)));
    expect(showcaseOwner.data.artifactPlacementsAsContainer.map((p) => p.artifact.id)).toContain(
      waifu.id,
    );

    // Unpinning root placement works via DELETE /artifactPlacement/:id (and refuses strangers)
    expect((await adminFetch(del(`/api/v1/artifactPlacement/${waifuPin.id}`))).status).toBe(403);
    expect((await outsiderFetch(del(`/api/v1/artifactPlacement/${waifuPin.id}`))).status).toBe(204);

    // Regression: artifactPlacementsAsArtifact relation is rejected by artifactListFilterLens (no cross-tenant pin oracle)
    expect(
      (
        await outsiderFetch(
          get(
            `/api/v1/organization/${organization.id}/artifacts?searchFields[artifactPlacementsAsArtifact][some][id][startsWith]=0`,
          ),
        )
      ).status,
    ).toBe(400);

    // Regression: expired grant is excluded in SQL so pagination.total stays 0
    const expDoc = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'expired-secret-report', readAccess: 'private' },
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
    expect((await place(memberFetch, drafts, shared, { readAccess: 'public' })).status).toBe(403);
    const draftsRootEdge = await db.artifactPlacement.findFirstOrThrow({
      where: { artifactId: drafts.id },
    });
    expect(
      (
        await memberFetch(
          post(`/api/v1/artifactPlacement/${draftsRootEdge.id}/move`, {
            targetContainerArtifactId: shared.id,
            readAccess: 'public',
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
          post('/api/v1/me/artifacts', {
            kind: 'folder',
            name: 'nope-pub',
            readAccess: 'public',
          }),
        )
      ).status,
    ).toBe(403);
    const pubOrgDoc = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'org-pub-doc', readAccess: 'public' },
    );
    expect(
      (
        await memberUserTokenFetch(
          post(`/api/v1/artifact/${pubOrgDoc.id}/artifactPlacements`, {
            ownerModel: 'User',
            userId: outsider.id,
            readAccess: 'public',
          }),
        )
      ).status,
    ).toBe(403);

    // 2. Filtered placement query pagination.total never leaks hidden private placement inside public folder,
    // and explicit containerArtifact[kind]=root still returns public root reshares anonymously
    const pubFolder = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'pub-folder',
      readAccess: 'public',
    });
    const privatePinInPub = (
      await parseSuccessBody<ArtifactPlacement>(
        await place(outsiderFetch, pubOrgDoc, pubFolder, { readAccess: 'private' }),
      )
    ).data;
    expect(privatePinInPub.readAccess).toBe('private');
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
        await place(adminFetch, pubFolder, shared, { readAccess: 'private' }),
      )
    ).data;
    expect(
      (await memberFetch(del(`/api/v1/artifactPlacement/${hiddenPinInShared.id}`))).status,
    ).toBe(403);
    expect(
      (
        await memberFetch(
          post(`/api/v1/artifactPlacement/${hiddenPinInShared.id}/move`, {
            targetContainerArtifactId: drafts.id,
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
          post(`/api/v1/artifact/${pubFolder.id}/copy`, {
            targetContainerArtifactId: memberOwned.id,
          }),
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
            readAccess: 'private',
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
    const adminPersonalEdge = await db.artifactPlacement.findFirstOrThrow({
      where: { artifactId: adminPersonal.id },
    });
    expect(
      (
        await adminFetch(
          post(`/api/v1/artifactPlacement/${adminPersonalEdge.id}/move`, {
            targetContainerArtifactId: shared.id,
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

    // 8. Cross-owner private pin does NOT flip exclusive to false on owner's folder detail,
    // and a personal file pinned inside an org folder is NEVER marked exclusive on that org folder.
    const ownedChild = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'owned-child',
      containerArtifactId: pubFolder.id,
    });
    expect((await place(adminFetch, ownedChild, shared, { readAccess: 'private' })).status).toBe(
      201,
    );
    const pubFolderDetail = await parseSuccessBody<{
      artifactPlacementsAsContainer: { artifact: Artifact & { exclusive: boolean } }[];
    }>(await outsiderFetch(get(`/api/v1/artifact/${pubFolder.id}`)));
    const childRow = pubFolderDetail.data.artifactPlacementsAsContainer.find(
      (p) => p.artifact.id === ownedChild.id,
    );
    expect(childRow?.artifact.exclusive).toBe(true);

    const adminPersonalPin = await createFolder(adminFetch, '/api/v1/me/artifacts', {
      name: 'admin-personal-pin',
    });
    expect((await place(adminFetch, adminPersonalPin, shared)).status).toBe(201);
    const sharedDetail = await parseSuccessBody<{
      artifactPlacementsAsContainer: { artifact: Artifact & { exclusive: boolean } }[];
    }>(await adminFetch(get(`/api/v1/artifact/${shared.id}`)));
    const pinnedPersonalRow = sharedDetail.data.artifactPlacementsAsContainer.find(
      (p) => p.artifact.id === adminPersonalPin.id,
    );
    expect(pinnedPersonalRow?.artifact.exclusive).toBe(false);

    // 9. ArtifactPermission.fromVersion requires >= 1 on create and update, and may move both up and down
    expect(
      (
        await adminFetch(
          post(`/api/v1/artifact/${pubOrgDoc.id}/artifactPermissions`, {
            granteeModel: 'User',
            granteeUserId: outsider.id,
            role: 'viewer',
            fromVersion: 0,
          }),
        )
      ).status,
    ).toBe(422);
    const versionGrant = (
      await parseSuccessBody<{ id: string; fromVersion: number }>(
        await adminFetch(
          post(`/api/v1/artifact/${pubOrgDoc.id}/artifactPermissions`, {
            granteeModel: 'User',
            granteeUserId: outsider.id,
            role: 'viewer',
            fromVersion: 1,
          }),
        ),
      )
    ).data;
    expect(versionGrant.fromVersion).toBe(1);
    expect(
      (await adminFetch(patch(`/api/v1/artifactPermission/${versionGrant.id}`, { fromVersion: 0 })))
        .status,
    ).toBe(422);
    expect(
      (
        await adminFetch(
          patch(`/api/v1/artifactPermission/${versionGrant.id}`, { fromVersion: 2_147_483_648 }),
        )
      ).status,
    ).toBe(422);
    const raised = await parseSuccessBody<{ fromVersion: number }>(
      await adminFetch(patch(`/api/v1/artifactPermission/${versionGrant.id}`, { fromVersion: 3 })),
    );
    expect(raised.data.fromVersion).toBe(3);
    const lowered = await parseSuccessBody<{ fromVersion: number }>(
      await adminFetch(patch(`/api/v1/artifactPermission/${versionGrant.id}`, { fromVersion: 2 })),
    );
    expect(lowered.data.fromVersion).toBe(2);
  });

  it('ReadAccess/OperateAccess split: operateAccess tenant, private+tenant access, User+tenant 422, PATCH empty body 422, and entitlement-only /me lists', async () => {
    const viewerSeat = await createOrganizationUser({ role: 'viewer' }, { organization });
    const viewerFetch = createTestApp({
      mockUser: viewerSeat.context.user,
      mockOrganizationUsers: [viewerSeat.entity],
      mount,
    }).fetch;

    // 1. Organization folder with readAccess: 'private', operateAccess: 'tenant':
    // org member can read, list (flat + root placements), rename, and add children; org viewer gets 403 and sees neither list
    const teamBoard = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'team-board', readAccess: 'private', operateAccess: 'tenant' },
    );
    expect(teamBoard.effectiveReadAccess).toBe('private');
    expect(teamBoard.effectiveOperateAccess).toBe('tenant');

    expect((await memberFetch(get(`/api/v1/artifact/${teamBoard.id}`))).status).toBe(200);
    expect(
      (await memberFetch(patch(`/api/v1/artifact/${teamBoard.id}`, { name: 'team-board-v2' })))
        .status,
    ).toBe(200);
    // member holds operate on teamBoard via operateAccess: 'tenant', so they can place into it
    expect((await place(memberFetch, drafts, teamBoard)).status).toBe(201);
    const boardChild = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'board-child', containerArtifactId: teamBoard.id },
    );
    expect(boardChild.effectiveOperateAccess).toBe('tenant');
    expect(boardChild.effectiveReadAccess).toBe('private');
    expect(
      (await memberFetch(patch(`/api/v1/artifact/${boardChild.id}`, { name: 'board-child-v2' })))
        .status,
    ).toBe(200);

    // Regression: readAccess: 'private' + implicit operateAccess: 'inherit' inside a tenant-operable folder
    // stays visible and removable for org members on folder detail, filtered placements, and DELETE.
    const privateReadChild = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'private-read-team-op', containerArtifactId: teamBoard.id, readAccess: 'private' },
    );
    expect(privateReadChild.effectiveReadAccess).toBe('private');
    expect(privateReadChild.effectiveOperateAccess).toBe('tenant');
    const teamDetailAsMember = await parseSuccessBody<{
      artifactPlacementsAsContainer: { id: string; artifact: Artifact }[];
    }>(await memberFetch(get(`/api/v1/artifact/${teamBoard.id}`)));
    expect(
      teamDetailAsMember.data.artifactPlacementsAsContainer.map((p) => p.artifact.id),
    ).toContain(privateReadChild.id);
    const filteredPlacementsAsMember = await parseSuccessBody<ArtifactPlacement[]>(
      await memberFetch(
        get(
          `/api/v1/organization/${organization.id}/artifactPlacements?searchFields[containerArtifactId]=${teamBoard.id}`,
        ),
      ),
    );
    expect(filteredPlacementsAsMember.data.map((p) => p.artifactId)).toContain(privateReadChild.id);
    // Viewer still sees none of them
    const filteredPlacementsAsViewer = await parseSuccessBody<ArtifactPlacement[]>(
      await viewerFetch(
        get(
          `/api/v1/organization/${organization.id}/artifactPlacements?searchFields[containerArtifactId]=${teamBoard.id}`,
        ),
      ),
    );
    expect(filteredPlacementsAsViewer.data).toEqual([]);

    const memberOrgList = await parseSuccessBody<Artifact[]>(
      await memberFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
    );
    expect(memberOrgList.data.map((a) => a.id)).toContain(teamBoard.id);
    const memberOrgPlacements = await parseSuccessBody<ArtifactPlacement[]>(
      await memberFetch(get(`/api/v1/organization/${organization.id}/artifactPlacements`)),
    );
    expect(memberOrgPlacements.data.map((p) => p.artifactId)).toContain(teamBoard.id);

    expect((await viewerFetch(get(`/api/v1/artifact/${teamBoard.id}`))).status).toBe(403);
    expect(
      (await viewerFetch(patch(`/api/v1/artifact/${teamBoard.id}`, { name: 'nope' }))).status,
    ).toBe(403);
    const viewerOrgList = await parseSuccessBody<Artifact[]>(
      await viewerFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
    );
    expect(viewerOrgList.data.map((a) => a.id)).not.toContain(teamBoard.id);
    const viewerOrgPlacements = await parseSuccessBody<ArtifactPlacement[]>(
      await viewerFetch(get(`/api/v1/organization/${organization.id}/artifactPlacements`)),
    );
    expect(viewerOrgPlacements.data.map((p) => p.artifactId)).not.toContain(teamBoard.id);

    // 2. Public artifact never grants operate to outsiders or org members
    const pubDoc = await createFolder(
      adminFetch,
      `/api/v1/organization/${organization.id}/artifacts`,
      { name: 'pub-readonly', readAccess: 'public' },
    );
    expect((await outsiderFetch(get(`/api/v1/artifact/${pubDoc.id}`))).status).toBe(200);
    expect(
      (await outsiderFetch(patch(`/api/v1/artifact/${pubDoc.id}`, { name: 'hacked' }))).status,
    ).toBe(403);
    expect(
      (await memberFetch(patch(`/api/v1/artifact/${pubDoc.id}`, { name: 'hacked' }))).status,
    ).toBe(403);

    // 3. PATCH /artifactPlacement/:id rejects empty {} (422) and updates readAccess/operateAccess independently
    const teamBoardEdge = await db.artifactPlacement.findFirstOrThrow({
      where: { artifactId: teamBoard.id },
    });
    expect(
      (await adminFetch(patch(`/api/v1/artifactPlacement/${teamBoardEdge.id}`, {}))).status,
    ).toBe(422);
    expect(
      (
        await adminFetch(
          patch(`/api/v1/artifactPlacement/${teamBoardEdge.id}`, { readAccess: 'tenant' }),
        )
      ).status,
    ).toBe(200);
    const updatedEdge = await db.artifactPlacement.findUniqueOrThrow({
      where: { id: teamBoardEdge.id },
    });
    expect(updatedEdge.readAccess).toBe('tenant');
    expect(updatedEdge.operateAccess).toBe('tenant');
    expect((await viewerFetch(get(`/api/v1/artifact/${teamBoard.id}`))).status).toBe(200);
    expect(
      (await viewerFetch(patch(`/api/v1/artifact/${teamBoard.id}`, { name: 'nope' }))).status,
    ).toBe(403);

    // 4. User + tenant is rejected with 422 across create, place, update, and move
    expect(
      (
        await outsiderFetch(
          post('/api/v1/me/artifacts', {
            kind: 'folder',
            name: 'bad-user-read',
            readAccess: 'tenant',
          }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await outsiderFetch(
          post('/api/v1/me/artifacts', {
            kind: 'folder',
            name: 'bad-user-op',
            operateAccess: 'tenant',
          }),
        )
      ).status,
    ).toBe(422);
    const userFolder = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'user-folder',
    });
    const userChild = await createFolder(outsiderFetch, '/api/v1/me/artifacts', {
      name: 'user-child',
    });
    expect(
      (await place(outsiderFetch, userChild, userFolder, { readAccess: 'tenant' })).status,
    ).toBe(422);
    expect(
      (await place(outsiderFetch, userChild, userFolder, { operateAccess: 'tenant' })).status,
    ).toBe(422);
    const userChildEdge = await db.artifactPlacement.findFirstOrThrow({
      where: { artifactId: userChild.id },
    });
    expect(
      (
        await outsiderFetch(
          patch(`/api/v1/artifactPlacement/${userChildEdge.id}`, { readAccess: 'tenant' }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await outsiderFetch(
          patch(`/api/v1/artifactPlacement/${userChildEdge.id}`, { operateAccess: 'tenant' }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await outsiderFetch(
          post(`/api/v1/artifactPlacement/${userChildEdge.id}/move`, {
            targetContainerArtifactId: userFolder.id,
            operateAccess: 'tenant',
          }),
        )
      ).status,
    ).toBe(422);

    // 5. Entitlement-only User token gets 200 (not 403) on GET /me/artifacts and GET /me/artifactPlacements
    const { entity: entUserToken } = await createToken({
      ownerModel: 'User',
      userId: outsider.id,
      role: null,
      full: false,
      entitlements: [
        {
          sourceModel: 'User',
          sourceId: outsider.id,
          resource: 'Project',
          actions: ['read'],
        },
      ],
    });
    const entUserTokenFetch = createTestApp({
      mockToken: {
        ...entUserToken,
        targetEntitlements: await db.entitlement.findMany({
          where: { targetModel: 'Token', targetTokenId: entUserToken.id },
        }),
        user: outsider,
        organization: null,
        organizationUser: null,
        space: null,
        spaceUser: null,
        integration: null,
      },
      mount,
    }).fetch;
    const meArtifactsResp = await entUserTokenFetch(get('/api/v1/me/artifacts'));
    expect(meArtifactsResp.status).toBe(200);
    expect((await parseSuccessBody<Artifact[]>(meArtifactsResp)).data).toEqual([]);

    const mePlacementsResp = await entUserTokenFetch(get('/api/v1/me/artifactPlacements'));
    expect(mePlacementsResp.status).toBe(200);
    expect((await parseSuccessBody<ArtifactPlacement[]>(mePlacementsResp)).data).toEqual([]);
  });
});
