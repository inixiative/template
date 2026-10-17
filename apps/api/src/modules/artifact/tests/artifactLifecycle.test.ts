import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import type {
  Artifact,
  Organization,
  OrganizationUser,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createArtifact,
  createArtifactContainer,
  createArtifactPermission,
  createOrganizationUser,
} from '@template/db/test';
import { registerArtifactAccessHook } from '#/hooks/artifactAccess/hook';
import { registerAuditLogHook } from '#/hooks/auditLog/hook';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import { artifactRouter } from '#/modules/artifact';
import { artifactPermissionRouter } from '#/modules/artifactPermission';
import { batchRouter } from '#/modules/batch';
import { organizationRouter } from '#/modules/organization';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { del, get, json, post } from '#tests/utils/request';

const mount: MountFn[] = [
  (app) => {
    app.route('/api/v1/artifact', artifactRouter);
    app.route('/api/v1/artifactPermission', artifactPermissionRouter);
    app.route('/api/v1/batch', batchRouter);
    app.route('/api/v1/organization', organizationRouter);
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
  let testDb: ReturnType<typeof createTestApp>['db'];

  const seat = async (role: 'owner' | 'admin' | 'member') => {
    const { entity, context } = await createOrganizationUser({ role }, { organization });
    return { user: context.user, entity };
  };

  const orgArtifact = async (kind: string, extra: Record<string, unknown> = {}) =>
    (
      await createArtifact({
        kind,
        ownerModel: 'Organization',
        organizationId: organization.id,
        ...extra,
      })
    ).entity;

  const placeInside = async (artifact: Artifact, container: Artifact) => {
    await createArtifactContainer({ artifactId: artifact.id, containerArtifactId: container.id });
    await db.artifact.update({ where: { id: artifact.id }, data: { access: 'inherit' } });
  };

  const status = async (fetch: Fetch, artifact: Artifact) =>
    (await fetch(get(`/api/v1/artifact/${artifact.id}/access`))).status;

  beforeAll(async () => {
    registerArtifactAccessHook();
    registerSoftDeleteCascadeHook();
    registerAuditLogHook();
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
    testDb = harness.db;
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

  afterAll(async () => {
    await cleanupTouchedTables(testDb);
    clearHookRegistry();
  });

  describe("a member's org-user content", () => {
    let memberFolder: Artifact;
    let note: Artifact;

    beforeAll(async () => {
      memberFolder = await orgArtifact('organizationUserFolder', { system: true });
      await createArtifactPermission({
        artifactId: memberFolder.id,
        granteeModel: 'OrganizationUser',
        granteeOrganizationId: organization.id,
        granteeUserId: member.id,
        role: 'owner',
      });
      note = await orgArtifact('folder');
      await placeInside(note, memberFolder);
    });

    it('the member reaches it, org owners reach it, org admins do not', async () => {
      expect(await status(memberFetch, note)).toBe(200);
      expect(await status(ownerFetch, note)).toBe(200);
      expect(await status(adminFetch, note)).toBe(404);
      expect(await status(adminFetch, memberFolder)).toBe(404);
    });

    it('an explicit grant always works', async () => {
      await createArtifactPermission({
        artifactId: note.id,
        granteeModel: 'User',
        granteeUserId: admin.id,
        role: 'viewer',
      });
      expect(await status(adminFetch, note)).toBe(200);
    });

    it('is a system kind the plain create route refuses', async () => {
      const response = await ownerFetch(
        post(`/api/v1/organization/${organization.id}/artifacts`, {
          kind: 'organizationUserFolder',
          name: 'mine',
        }),
      );
      expect(response.status).toBe(422);
    });
  });

  it('a container may sit in several parents of the same owner', async () => {
    const legal = await orgArtifact('folder');
    const operations = await orgArtifact('folder');
    const compliance = await orgArtifact('folder');
    for (const parent of [legal, operations]) {
      const response = await ownerFetch(
        post(`/api/v1/artifact/${compliance.id}/artifactContainers`, {
          containerArtifactId: parent.id,
        }),
      );
      expect(response.status).toBe(201);
    }
  });

  describe('navigating a diamond: compliance under legal and operations, both under one root', () => {
    let root: Artifact;
    let legal: Artifact;
    let operations: Artifact;
    let compliance: Artifact;
    type Ancestry = {
      artifacts: Artifact[];
      edges: { artifactId: string; containerArtifactId: string }[];
    };

    beforeAll(async () => {
      root = await orgArtifact('folder', { name: 'root' });
      legal = await orgArtifact('folder', { name: 'legal' });
      operations = await orgArtifact('folder', { name: 'operations' });
      compliance = await orgArtifact('folder', { name: 'compliance' });
      await placeInside(legal, root);
      await placeInside(operations, root);
      await placeInside(compliance, legal);
      await placeInside(compliance, operations);
    });

    it('parents lists both direct containers', async () => {
      const { data } = await json<Artifact[]>(
        await ownerFetch(get(`/api/v1/artifact/${compliance.id}/parents`)),
      );
      expect(data.map((artifact) => artifact.id).sort()).toEqual([legal.id, operations.id].sort());
    });

    it('ancestors returns the upward graph with the shared root once', async () => {
      const { data } = await json<Ancestry>(
        await ownerFetch(get(`/api/v1/artifact/${compliance.id}/ancestors`)),
      );
      expect(data.artifacts.map((artifact) => artifact.id).sort()).toEqual(
        [root.id, legal.id, operations.id].sort(),
      );
      const edgeKeys = data.edges.map((edge) => `${edge.artifactId}>${edge.containerArtifactId}`);
      expect(edgeKeys.sort()).toEqual(
        [
          `${compliance.id}>${legal.id}`,
          `${compliance.id}>${operations.id}`,
          `${legal.id}>${root.id}`,
          `${operations.id}>${root.id}`,
        ].sort(),
      );
    });

    it('ancestors and parents only show containers the caller can read', async () => {
      await db.artifact.update({ where: { id: compliance.id }, data: { access: 'private' } });
      await createArtifactPermission({
        artifactId: compliance.id,
        granteeModel: 'User',
        granteeUserId: member.id,
        role: 'viewer',
      });
      const ancestry = await json<Ancestry>(
        await memberFetch(get(`/api/v1/artifact/${compliance.id}/ancestors`)),
      );
      expect(ancestry.data).toEqual({ artifacts: [], edges: [] });
      const parents = await json<Artifact[]>(
        await memberFetch(get(`/api/v1/artifact/${compliance.id}/parents`)),
      );
      expect(parents.data).toEqual([]);
    });

    it("the owner's root listing holds artifacts in no container", async () => {
      const { data } = await json<Artifact[]>(
        await ownerFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
      );
      const ids = data.map((artifact) => artifact.id);
      expect(ids).toContain(root.id);
      expect(ids).not.toContain(legal.id);
      expect(ids).not.toContain(compliance.id);
    });
  });

  describe('deleting', () => {
    let shared: Artifact;
    let other: Artifact;

    beforeAll(async () => {
      shared = await orgArtifact('folder');
      other = await orgArtifact('folder');
    });

    it('an artifact in more than one container needs own; in one, manage is enough', async () => {
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
      expect((await memberFetch(del(`/api/v1/artifact/${inOne.id}`))).status).toBe(204);
      expect((await ownerFetch(del(`/api/v1/artifact/${inBoth.id}`))).status).toBe(204);
    });

    it('deleting a container keeps its contents; contents only there are listed and deleted through batch', async () => {
      const box = await orgArtifact('folder');
      const onlyHere = await orgArtifact('folder');
      const alsoElsewhere = await orgArtifact('folder');
      await placeInside(onlyHere, box);
      await placeInside(alsoElsewhere, box);
      await placeInside(alsoElsewhere, other);

      const listing = await json<Artifact[]>(
        await ownerFetch(get(`/api/v1/artifact/${box.id}/exclusiveContents`)),
      );
      expect(listing.data.map((artifact) => artifact.id)).toEqual([onlyHere.id]);

      expect((await ownerFetch(del(`/api/v1/artifact/${box.id}`))).status).toBe(204);
      const kept = await db.artifact.findUniqueOrThrow({ where: { id: onlyHere.id } });
      expect(kept.deletedAt).toBeNull();
      expect(kept.access).toBe('private');
      const stillPlaced = await db.artifact.findUniqueOrThrow({ where: { id: alsoElsewhere.id } });
      expect(stillPlaced.access).toBe('inherit');

      const batch = await ownerFetch(
        post('/api/v1/batch/execute', {
          strategy: 'transactionAll',
          requests: [
            listing.data.map((artifact) => ({
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
    expect(await status(memberFetch, folder)).toBe(404);
    const created = await json<{ id: string }>(
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
    expect(await status(memberFetch, folder)).toBe(404);
    const audit = await db.auditLog.findMany({
      where: { subjectArtifactPermissionId: created.data.id },
    });
    expect(audit.length).toBeGreaterThanOrEqual(2);

    const again = await ownerFetch(
      post(`/api/v1/artifact/${folder.id}/artifactPermissions`, grant),
    );
    expect(again.status).toBe(201);
  });
});
