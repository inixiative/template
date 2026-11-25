import { beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type {
  Artifact,
  ArtifactPermission,
  ArtifactPlacement,
  Organization,
  OrganizationUser,
  User,
} from '@template/db/generated/client/client';
import type { ArtifactAccess, ArtifactKind } from '@template/db/generated/client/enums';
import {
  createArtifact,
  createArtifactPermission,
  createArtifactPlacement,
  createOrganizationUser,
} from '@template/db/test';
import { artifactRouter } from '#/modules/artifact';
import { artifactPermissionRouter } from '#/modules/artifactPermission';
import { artifactPlacementRouter } from '#/modules/artifactPlacement';
import { batchRouter } from '#/modules/batch';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { del, get, parseSuccessBody, patch, post } from '#tests/utils/request';

const mount: MountFn[] = [
  (app) => {
    app.route('/api/v1/artifact', artifactRouter);
    app.route('/api/v1/artifactPlacement', artifactPlacementRouter);
    app.route('/api/v1/artifactPermission', artifactPermissionRouter);
    app.route('/api/v1/batch', batchRouter);
    app.route('/api/v1/organization', organizationRouter);
    app.route('/api/v1/organizationUser', organizationUserRouter);
    app.route('/api/v1/me', meRouter);
  },
];

type Fetch = ReturnType<typeof createTestApp>['fetch'];

describe('artifact lifecycle', () => {
  let organization: Organization;
  let owner: User;
  let admin: User;
  let member: User;
  let memberSeat: OrganizationUser;
  let ownerFetch: Fetch;
  let adminFetch: Fetch;
  let memberFetch: Fetch;

  const seat = async (role: 'owner' | 'admin' | 'member') => {
    const { entity, context } = await createOrganizationUser({ role }, { organization });
    return { user: context.user, entity };
  };

  const orgArtifact = async (kind: ArtifactKind, extra: Record<string, unknown> = {}) =>
    (
      await createArtifact({
        kind,
        ownerModel: 'Organization',
        organizationId: organization.id,
        ...extra,
      })
    ).entity;

  const placeInside = async (
    artifact: Artifact,
    container: Artifact,
    access: ArtifactAccess = 'inherit',
  ) =>
    (
      await createArtifactPlacement({
        artifactId: artifact.id,
        containerArtifactId: container.id,
        access,
      })
    ).entity;

  const status = async (fetch: Fetch, artifact: Artifact) =>
    (await fetch(get(`/api/v1/artifact/${artifact.id}`))).status;

  beforeEach(async () => {
    const first = await createOrganizationUser({ role: 'owner' });
    organization = first.context.organization;
    owner = first.context.user;
    const adminSeat = await seat('admin');
    admin = adminSeat.user;
    const memberSeatCreated = await seat('member');
    member = memberSeatCreated.user;
    memberSeat = memberSeatCreated.entity;

    const harness = createTestApp({
      mockUser: owner,
      mockOrganizationUsers: [first.entity],
      mount,
    });
    ownerFetch = harness.fetch;
    adminFetch = createTestApp({
      mockUser: admin,
      mockOrganizationUsers: [adminSeat.entity],
      mount,
    }).fetch;
    memberFetch = createTestApp({
      mockUser: member,
      mockOrganizationUsers: [memberSeat],
      mount,
    }).fetch;
  });

  describe('5-way OrganizationUser-owned artifacts', () => {
    let note: Artifact;

    beforeEach(async () => {
      const response = await memberFetch(
        post(`/api/v1/organizationUser/${memberSeat.id}/artifacts`, {
          kind: 'folder',
          name: 'private-note',
        }),
      );
      expect(response.status).toBe(201);
      note = (await parseSuccessBody<Artifact>(response)).data;
    });

    it('org owners have read/delete break-glass (no manage); admins get 403; org root never lists it', async () => {
      expect(await status(memberFetch, note)).toBe(200);
      expect(await status(ownerFetch, note)).toBe(200);
      expect(await status(adminFetch, note)).toBe(403);
      expect(
        (await ownerFetch(patch(`/api/v1/artifact/${note.id}`, { name: 'nope' }))).status,
      ).toBe(403);
      const adminListPrivate = await parseSuccessBody<Artifact[]>(
        await adminFetch(get(`/api/v1/organizationUser/${memberSeat.id}/artifacts`)),
      );
      expect(adminListPrivate.data.map((artifact) => artifact.id)).not.toContain(note.id);
      const memberRoots = await parseSuccessBody<Artifact[]>(
        await memberFetch(get(`/api/v1/organizationUser/${memberSeat.id}/artifacts`)),
      );
      expect(memberRoots.data.map((artifact) => artifact.id)).toContain(note.id);
      const orgRoots = await parseSuccessBody<Artifact[]>(
        await ownerFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
      );
      expect(orgRoots.data.map((artifact) => artifact.id)).not.toContain(note.id);
      expect((await ownerFetch(del(`/api/v1/artifact/${note.id}`))).status).toBe(204);
    });

    it('flipping a member artifact root placement to tenant makes it visible to coworkers on GET /organizationUser/:id/{artifacts,artifactPlacements}', async () => {
      const rootPlacement = await db.artifactPlacement.findFirstOrThrow({
        where: { artifactId: note.id },
      });
      expect(
        (
          await memberFetch(
            patch(`/api/v1/artifactPlacement/${rootPlacement.id}`, { access: 'tenant' }),
          )
        ).status,
      ).toBe(200);
      const adminListTenant = await parseSuccessBody<Artifact[]>(
        await adminFetch(get(`/api/v1/organizationUser/${memberSeat.id}/artifacts`)),
      );
      expect(adminListTenant.data.map((artifact) => artifact.id)).toContain(note.id);
      const adminPlacements = await parseSuccessBody<ArtifactPlacement[]>(
        await adminFetch(get(`/api/v1/organizationUser/${memberSeat.id}/artifactPlacements`)),
      );
      expect(adminPlacements.data.map((p) => p.artifactId)).toContain(note.id);
    });

    it('an explicit grant opens it to an admin', async () => {
      await createArtifactPermission({
        artifactId: note.id,
        granteeModel: 'User',
        granteeUserId: admin.id,
        role: 'viewer',
      });
      expect(await status(adminFetch, note)).toBe(200);
    });
  });

  it('a container may sit in several parents of the same owner', async () => {
    const legal = await orgArtifact('folder');
    const operations = await orgArtifact('folder');
    const compliance = await orgArtifact('folder');
    for (const parent of [legal, operations]) {
      const response = await ownerFetch(
        post(`/api/v1/artifact/${compliance.id}/artifactPlacements`, {
          containerArtifactId: parent.id,
        }),
      );
      expect(response.status).toBe(201);
    }
  });

  describe('navigating a diamond: compliance under legal and operations, both under one folder', () => {
    let topFolder: Artifact;
    let legal: Artifact;
    let operations: Artifact;
    let compliance: Artifact;
    let complianceInLegal: ArtifactPlacement;
    let complianceInOps: ArtifactPlacement;
    type Neighbor = Artifact & { artifactPermissions: ArtifactPermission[] };
    type ParentPlacement = ArtifactPlacement & { containerArtifact: Neighbor };
    type ChildPlacement = ArtifactPlacement & { artifact: Neighbor & { exclusive: boolean } };

    beforeEach(async () => {
      const rootResp = await ownerFetch(
        post(`/api/v1/organization/${organization.id}/artifacts`, {
          kind: 'folder',
          name: 'top-folder',
        }),
      );
      topFolder = (await parseSuccessBody<Artifact>(rootResp)).data;
      legal = await orgArtifact('folder', { name: 'legal' });
      operations = await orgArtifact('folder', { name: 'operations' });
      compliance = await orgArtifact('folder', { name: 'compliance' });
      await placeInside(legal, topFolder);
      await placeInside(operations, topFolder);
      complianceInLegal = await placeInside(compliance, legal);
      complianceInOps = await placeInside(compliance, operations);
    });

    it('GET /artifact/:id returns 1-step artifactPlacementsAsArtifact and artifactPlacementsAsContainer and hides unreadable containers', async () => {
      const { data: complianceDetail } = await parseSuccessBody<{
        artifactPlacementsAsArtifact: ParentPlacement[];
        artifactPlacementsAsContainer: ChildPlacement[];
      }>(await ownerFetch(get(`/api/v1/artifact/${compliance.id}`)));
      expect(
        complianceDetail.artifactPlacementsAsArtifact
          .map((placement) => placement.containerArtifact.id)
          .sort(),
      ).toEqual([legal.id, operations.id].sort());
      expect(complianceDetail.artifactPlacementsAsContainer).toEqual([]);

      const { data: topDetail } = await parseSuccessBody<{
        artifactPlacementsAsArtifact: ParentPlacement[];
        artifactPlacementsAsContainer: ChildPlacement[];
      }>(await ownerFetch(get(`/api/v1/artifact/${topFolder.id}`)));
      expect(topDetail.artifactPlacementsAsArtifact).toHaveLength(1);
      expect(topDetail.artifactPlacementsAsArtifact[0]!.containerArtifact.kind).toBe('root');
      expect(
        topDetail.artifactPlacementsAsContainer.map((placement) => placement.artifact.id).sort(),
      ).toEqual([legal.id, operations.id].sort());
      expect(
        topDetail.artifactPlacementsAsContainer.every(
          (placement) => placement.artifact.exclusive && placement.access === 'inherit',
        ),
      ).toBe(true);

      await db.artifactPlacement.update({
        where: { id: complianceInLegal.id },
        data: { access: 'private' },
      });
      await db.artifactPlacement.update({
        where: { id: complianceInOps.id },
        data: { access: 'private' },
      });
      await createArtifactPermission({
        artifactId: compliance.id,
        granteeModel: 'User',
        granteeUserId: member.id,
        role: 'viewer',
      });
      const asMember = await parseSuccessBody<{
        artifactPlacementsAsArtifact: ParentPlacement[];
        artifactPlacementsAsContainer: ChildPlacement[];
      }>(await memberFetch(get(`/api/v1/artifact/${compliance.id}`)));
      expect(asMember.data.artifactPlacementsAsArtifact).toEqual([]);
      expect(asMember.data.artifactPlacementsAsContainer).toEqual([]);
    });

    it("the owner's root placement listing holds only items placed directly in root", async () => {
      const { data } = await parseSuccessBody<ArtifactPlacement[]>(
        await ownerFetch(get(`/api/v1/organization/${organization.id}/artifactPlacements`)),
      );
      const ids = data.map((placement) => placement.artifactId);
      expect(ids).toContain(topFolder.id);
      expect(ids).not.toContain(legal.id);
      expect(ids).not.toContain(compliance.id);
    });
  });

  describe('deleting', () => {
    let shared: Artifact;
    let other: Artifact;

    beforeEach(async () => {
      shared = await orgArtifact('folder');
      other = await orgArtifact('folder');
    });

    it('deleting always needs own: an admin grant is not enough, wherever the artifact sits', async () => {
      const inBoth = await orgArtifact('folder');
      await placeInside(inBoth, shared);
      await placeInside(inBoth, other);
      const inOne = await orgArtifact('folder');
      await placeInside(inOne, shared);
      for (const artifact of [inBoth, inOne]) {
        await createArtifactPermission({
          artifactId: artifact.id,
          granteeModel: 'User',
          granteeUserId: member.id,
          role: 'admin',
        });
      }
      expect((await memberFetch(del(`/api/v1/artifact/${inBoth.id}`))).status).toBe(403);
      expect((await memberFetch(del(`/api/v1/artifact/${inOne.id}`))).status).toBe(403);
      expect((await adminFetch(del(`/api/v1/artifact/${inOne.id}`))).status).toBe(403);
      expect((await ownerFetch(del(`/api/v1/artifact/${inBoth.id}`))).status).toBe(204);
      expect((await ownerFetch(del(`/api/v1/artifact/${inOne.id}`))).status).toBe(204);
    });

    it('removing it from a container still needs only manage on it and operate on the container', async () => {
      const shelf = await orgArtifact('folder');
      const item = await orgArtifact('folder');
      await placeInside(item, shelf);
      await placeInside(item, other);
      await createArtifactPermission({
        artifactId: item.id,
        granteeModel: 'User',
        granteeUserId: member.id,
        role: 'admin',
      });
      await createArtifactPermission({
        artifactId: shelf.id,
        granteeModel: 'User',
        granteeUserId: member.id,
        role: 'member',
      });
      const [edge] = await db.artifactPlacement.findMany({
        where: { artifactId: item.id, containerArtifactId: shelf.id },
      });
      expect((await memberFetch(del(`/api/v1/artifactPlacement/${edge?.id}`))).status).toBe(204);
    });

    it('deleting a container keeps its contents, reparents exclusive owned children to root, and supports batch delete', async () => {
      const box = await orgArtifact('folder');
      const onlyHere = await orgArtifact('folder');
      const alsoElsewhere = await orgArtifact('folder');
      await placeInside(onlyHere, box);
      await placeInside(alsoElsewhere, box);
      await placeInside(alsoElsewhere, other);

      const boxDetail = await parseSuccessBody<{
        artifactPlacementsAsContainer: { artifact: Artifact & { exclusive: boolean } }[];
      }>(await ownerFetch(get(`/api/v1/artifact/${box.id}`)));
      const exclusiveChildren = boxDetail.data.artifactPlacementsAsContainer
        .map((placement) => placement.artifact)
        .filter((child) => child.exclusive);
      expect(exclusiveChildren.map((artifact) => artifact.id)).toEqual([onlyHere.id]);

      expect((await ownerFetch(del(`/api/v1/artifact/${box.id}`))).status).toBe(204);
      const kept = await db.artifact.findUniqueOrThrow({ where: { id: onlyHere.id } });
      expect(kept.deletedAt).toBeNull();
      const rootPlacements = await parseSuccessBody<ArtifactPlacement[]>(
        await ownerFetch(get(`/api/v1/organization/${organization.id}/artifactPlacements`)),
      );
      expect(rootPlacements.data.map((placement) => placement.artifactId)).toContain(onlyHere.id);
      const stillPlaced = await db.artifactPlacement.findFirstOrThrow({
        where: { artifactId: alsoElsewhere.id, containerArtifactId: other.id },
      });
      expect(stillPlaced.access).toBe('inherit');

      const batch = await ownerFetch(
        post('/api/v1/batch/execute', {
          strategy: 'transactionAll',
          requests: [
            exclusiveChildren.map((artifact) => ({
              method: 'DELETE',
              path: `/api/v1/artifact/${artifact.id}`,
            })),
          ],
        }),
      );
      expect(batch.status).toBe(200);
      const removed = await db.artifact.findUniqueOrThrow({
        where: { id: onlyHere.id, deletedAt: undefined },
      });
      expect(removed.deletedAt).not.toBeNull();
    });
  });

  it('revoking a grant soft-deletes and audits it; the grantee can be granted again', async () => {
    const folder = await orgArtifact('folder');
    const grant = { granteeModel: 'User', granteeUserId: member.id, role: 'viewer' };
    expect(await status(memberFetch, folder)).toBe(403);
    const created = await parseSuccessBody<{ id: string }>(
      await ownerFetch(post(`/api/v1/artifact/${folder.id}/artifactPermissions`, grant)),
    );
    expect(await status(memberFetch, folder)).toBe(200);

    expect((await ownerFetch(del(`/api/v1/artifactPermission/${created.data.id}`))).status).toBe(
      204,
    );
    const revoked = await db.artifactPermission.findUniqueOrThrow({
      where: { id: created.data.id, deletedAt: undefined },
    });
    expect(revoked.deletedAt).not.toBeNull();
    expect(await status(memberFetch, folder)).toBe(403);
    const audit = await db.auditLog.findMany({
      where: { subjectArtifactPermissionId: created.data.id },
    });
    expect(audit.length).toBeGreaterThanOrEqual(2);

    const again = await ownerFetch(
      post(`/api/v1/artifact/${folder.id}/artifactPermissions`, grant),
    );
    expect(again.status).toBe(201);
  });

  it('access: private on placement inside a public folder keeps the artifact private and hidden from outsiders', async () => {
    const outsider = (await createOrganizationUser({}, {})).context.user;
    const outsiderFetch = createTestApp({ mockUser: outsider, mount }).fetch;
    const lobby = (
      await parseSuccessBody<Artifact>(
        await ownerFetch(
          post(`/api/v1/organization/${organization.id}/artifacts`, {
            kind: 'folder',
            name: 'lobby',
            access: 'public',
          }),
        ),
      )
    ).data;
    const file = await orgArtifact('file');
    const placed = await ownerFetch(
      post(`/api/v1/artifact/${file.id}/artifactPlacements`, {
        containerArtifactId: lobby.id,
        access: 'private',
      }),
    );
    expect(placed.status).toBe(201);
    expect((await outsiderFetch(get(`/api/v1/artifact/${file.id}`))).status).toBe(403);
    const lobbyAsOutsider = await parseSuccessBody<{
      artifactPlacementsAsContainer: { artifact: Artifact }[];
    }>(await outsiderFetch(get(`/api/v1/artifact/${lobby.id}`)));
    expect(
      lobbyAsOutsider.data.artifactPlacementsAsContainer.map((p) => p.artifact.id),
    ).not.toContain(file.id);
  });
});
