import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import type {
  Artifact,
  Organization,
  OrganizationUser,
  User,
} from '@template/db/generated/client/client';
import {
  InquiryResourceModel,
  InquiryStatus,
  InquiryType,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createArtifact,
  createArtifactPermission,
  createArtifactPlacement,
  createFile,
  createFileVersion,
  createInquiry,
  createOrganizationUser,
  createResourceBinding,
  createUser,
} from '@template/db/test';
import { registerArtifactAccessHook } from '#/hooks/artifactAccess/hook';
import { registerImmutableFieldsHook } from '#/hooks/immutableFields/hook';
import { registerOrganizationUserFolderHook } from '#/hooks/organizationUserFolder/hook';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
import { artifactRouter } from '#/modules/artifact';
import { findOrganizationUserFolder } from '#/modules/artifact/services/ensureOrganizationUserFolder';
import { artifactPlacementRouter } from '#/modules/artifactPlacement';
import { inquiryRouter } from '#/modules/inquiry';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { get, json, patch, post } from '#tests/utils/request';

const mount: MountFn[] = [
  (app) => {
    app.use('*', auditActorMiddleware);
    app.route('/api/v1/artifact', artifactRouter);
    app.route('/api/v1/artifactPlacement', artifactPlacementRouter);
    app.route('/api/v1/inquiry', inquiryRouter);
    app.route('/api/v1/me', meRouter);
    app.route('/api/v1/organization', organizationRouter);
  },
];

type Fetch = ReturnType<typeof createTestApp>['fetch'];

describe('artifact actions', () => {
  let organization: Organization;
  let admin: User;
  let adminSeat: OrganizationUser;
  let member: User;
  let memberSeat: OrganizationUser;
  let stranger: User;
  let adminFetch: Fetch;
  let memberFetch: Fetch;
  let strangerFetch: Fetch;
  let testDb: ReturnType<typeof createTestApp>['db'];

  const orgFolder = async (extra: Record<string, unknown> = {}) =>
    (
      await createArtifact({
        kind: 'folder',
        ownerModel: 'Organization',
        organizationId: organization.id,
        ...extra,
      })
    ).entity;

  const userFile = async (user: User) =>
    (await createArtifact({ kind: 'file', ownerModel: 'User', userId: user.id })).entity;

  const ids = (artifacts: Artifact[]) => artifacts.map((artifact) => artifact.id);

  beforeAll(async () => {
    registerArtifactAccessHook();
    registerImmutableFieldsHook();
    registerSoftDeleteCascadeHook();
    registerOrganizationUserFolderHook();
    const seat = await createOrganizationUser({ role: 'admin' });
    organization = seat.context.organization;
    admin = seat.context.user;
    adminSeat = seat.entity;
    const memberCreated = await createOrganizationUser({ role: 'member' }, { organization });
    member = memberCreated.context.user;
    memberSeat = memberCreated.entity;
    stranger = (await createUser()).entity;

    const harness = createTestApp({ mockUser: admin, mockOrganizationUsers: [adminSeat], mount });
    adminFetch = harness.fetch;
    testDb = harness.db;
    memberFetch = createTestApp({
      mockUser: member,
      mockOrganizationUsers: [memberSeat],
      mount,
    }).fetch;
    strangerFetch = createTestApp({ mockUser: stranger, mount }).fetch;
  });

  afterAll(async () => {
    await cleanupTouchedTables(testDb);
    clearHookRegistry();
  });

  it('every artifact is a container or an object, set from its kind and fixed', async () => {
    const folder = await orgFolder();
    const file = await userFile(member);
    expect(folder.type).toBe('container');
    expect(file.type).toBe('object');
    const after = await db.artifact.update({ where: { id: file.id }, data: { type: 'container' } });
    expect(after.type).toBe('object');
  });

  it('at root means no live placement: a removed placement puts the item back at root', async () => {
    const folder = await orgFolder();
    const item = await orgFolder();
    const { entity: placement } = await createArtifactPlacement({
      artifactId: item.id,
      containerArtifactId: folder.id,
    });
    const atRoot = () =>
      db.artifact.findMany({
        where: { id: item.id, placements: { none: {} } },
        select: { id: true },
      });
    expect(await atRoot()).toEqual([]);
    await db.artifactPlacement.update({
      where: { id: placement.id },
      data: { deletedAt: new Date() },
    });
    expect(await atRoot()).toEqual([{ id: item.id }]);
  });

  it("an item in a container the caller can't see shows at the caller's root", async () => {
    const hidden = await orgFolder();
    const report = await orgFolder({ name: 'report' });
    await createArtifactPlacement({ artifactId: report.id, containerArtifactId: hidden.id });
    await createArtifactPermission({
      artifactId: report.id,
      granteeModel: 'User',
      granteeUserId: member.id,
      role: 'viewer',
    });
    const asMember = await json<Artifact[]>(
      await memberFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
    );
    expect(ids(asMember.data)).toContain(report.id);
    const asAdmin = await json<Artifact[]>(
      await adminFetch(get(`/api/v1/organization/${organization.id}/artifacts`)),
    );
    expect(ids(asAdmin.data)).not.toContain(report.id);
  });

  it('move replaces a placement, from and to the root too', async () => {
    const a = await orgFolder();
    const b = await orgFolder();
    const item = await orgFolder();
    const into = await adminFetch(
      post(`/api/v1/artifact/${item.id}/move`, { toContainerArtifactId: a.id }),
    );
    expect(into.status).toBe(200);
    const across = await adminFetch(
      post(`/api/v1/artifact/${item.id}/move`, {
        fromContainerArtifactId: a.id,
        toContainerArtifactId: b.id,
      }),
    );
    expect(across.status).toBe(200);
    const placements = await db.artifactPlacement.findMany({ where: { artifactId: item.id } });
    expect(placements.map((placement) => placement.containerArtifactId)).toEqual([b.id]);
    const out = await adminFetch(
      post(`/api/v1/artifact/${item.id}/move`, { fromContainerArtifactId: b.id }),
    );
    expect(out.status).toBe(200);
    expect(await db.artifactPlacement.count({ where: { artifactId: item.id } })).toBe(0);
  });

  it("copy makes a new artifact in the container's owner, sharing the file's bytes until swept", async () => {
    const source = await userFile(member);
    const { entity: file } = await createFile({ artifactId: source.id });
    await createFileVersion({ fileId: file.id, key: 'k-1', version: 1 });
    await createArtifactPermission({
      artifactId: source.id,
      granteeModel: 'User',
      granteeUserId: admin.id,
      role: 'viewer',
    });
    const inbox = await orgFolder();
    const response = await adminFetch(
      post(`/api/v1/artifact/${source.id}/copy`, { containerArtifactId: inbox.id }),
    );
    expect(response.status).toBe(200);
    const copy = (await json<Artifact>(response)).data;
    expect(copy.ownerModel).toBe('Organization');
    const copied = await db.file.findUniqueOrThrow({
      where: { artifactId: copy.id },
      include: { versions: true },
    });
    expect(copied.sourceFileId).toBe(file.id);
    expect(copied.versions.map((version) => [version.key, version.status])).toEqual([
      ['k-1', 'pending'],
    ]);
  });

  it("placements stay within one owner: a file can't be placed in another owner's folder", async () => {
    const file = await userFile(admin);
    const folder = await orgFolder();
    const response = await adminFetch(
      post(`/api/v1/artifact/${file.id}/artifactPlacements`, { containerArtifactId: folder.id }),
    );
    expect(response.status).toBe(422);
  });

  it('uses shows only what the caller can see, with the owner and who has access', async () => {
    const hidden = await orgFolder();
    const shown = await orgFolder();
    const logo = await orgFolder();
    await createArtifactPlacement({ artifactId: logo.id, containerArtifactId: hidden.id });
    await createArtifactPlacement({ artifactId: logo.id, containerArtifactId: shown.id });
    for (const artifact of [logo, shown]) {
      await createArtifactPermission({
        artifactId: artifact.id,
        granteeModel: 'OrganizationUser',
        granteeOrganizationId: organization.id,
        granteeUserId: member.id,
        role: 'viewer',
      });
    }
    await createResourceBinding({
      sourceModel: 'Artifact',
      artifactId: logo.id,
      resourceModel: 'Organization',
      organizationId: organization.id,
      bindingType: 'logo',
    });
    const { data } = await json<{
      owner: { ownerModel: string };
      access: { grants: unknown[] };
      placements: { containerArtifactId: string }[];
      bindings: { bindingType: string }[];
    }>(await memberFetch(get(`/api/v1/artifact/${logo.id}/uses`)));
    expect(data.owner.ownerModel).toBe('Organization');
    expect(data.access.grants.length).toBeGreaterThan(0);
    expect(data.placements.map((placement) => placement.containerArtifactId)).toEqual([shown.id]);
    expect(data.bindings.map((binding) => binding.bindingType)).toEqual(['logo']);
  });

  describe('transferArtifact', () => {
    const transferTo = async (artifact: Artifact, from: User, keepTracking: boolean) =>
      (
        await createInquiry({
          type: InquiryType.transferArtifact,
          status: InquiryStatus.sent,
          sourceModel: InquiryResourceModel.User,
          sourceUserId: from.id,
          targetModel: InquiryResourceModel.Organization,
          targetOrganizationId: organization.id,
          content: { artifactId: artifact.id, keepTracking },
        })
      ).entity;

    it('on accept the artifact changes owner, its old grants go, and the sender keeps a read pointer', async () => {
      const file = await userFile(stranger);
      const own = await (
        await createArtifact({ kind: 'folder', ownerModel: 'User', userId: stranger.id })
      ).entity;
      await createArtifactPlacement({ artifactId: file.id, containerArtifactId: own.id });
      const inquiry = await transferTo(file, stranger, true);
      const resolved = await adminFetch(
        post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'approved' }),
      );
      expect(resolved.status).toBe(200);
      const after = await db.artifact.findUniqueOrThrow({ where: { id: file.id } });
      expect(after.ownerModel).toBe('Organization');
      expect(after.organizationId).toBe(organization.id);
      expect(await db.artifactPlacement.count({ where: { artifactId: file.id } })).toBe(0);
      const tracking = await db.resourceBinding.findMany({ where: { artifactId: file.id } });
      expect(tracking.map((binding) => [binding.bindingType, binding.userId])).toEqual([
        ['tracking', stranger.id],
      ]);
      const access = await json<{ role: string }>(
        await strangerFetch(get(`/api/v1/artifact/${file.id}/access`)),
      );
      expect(access.data.role).toBe('viewer');
      expect(
        (await strangerFetch(patch(`/api/v1/artifact/${file.id}`, { name: 'x' }))).status,
      ).toBe(403);
    });

    it('a receiver refusing the pointer leaves the sender a copy', async () => {
      const file = await userFile(stranger);
      const inquiry = await transferTo(file, stranger, true);
      await adminFetch(
        post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'approved', allowTracking: false }),
      );
      expect(await db.resourceBinding.count({ where: { artifactId: file.id } })).toBe(0);
      const copies = await db.artifact.findMany({
        where: { ownerModel: 'User', userId: stranger.id, name: file.name, id: { not: file.id } },
      });
      expect(copies).toHaveLength(1);
    });

    it("an org manager can't transfer a member's org-user content out", async () => {
      const memberFolder = await findOrganizationUserFolder(organization.id, member.id);
      const note = (
        await createArtifact({
          kind: 'file',
          ownerModel: 'Organization',
          organizationId: organization.id,
        })
      ).entity;
      await createArtifactPlacement({ artifactId: note.id, containerArtifactId: memberFolder!.id });
      const response = await adminFetch(
        post(`/api/v1/organization/${organization.id}/inquiries`, {
          type: InquiryType.transferArtifact,
          targetModel: InquiryResourceModel.User,
          targetUserId: admin.id,
          content: { artifactId: note.id },
          status: 'sent',
        }),
      );
      expect(response.status).toBe(422);
      expect((await db.artifact.findUniqueOrThrow({ where: { id: note.id } })).ownerModel).toBe(
        'Organization',
      );
    });

    it('one open transfer per artifact, not per receiver', async () => {
      const first = await userFile(stranger);
      const second = await userFile(stranger);
      await transferTo(first, stranger, false);
      const strangerSends = (artifact: Artifact) =>
        strangerFetch(
          post('/api/v1/me/inquiries', {
            type: InquiryType.transferArtifact,
            targetModel: InquiryResourceModel.Organization,
            targetOrganizationId: organization.id,
            content: { artifactId: artifact.id },
            status: 'sent',
          }),
        );
      expect((await strangerSends(second)).status).toBe(201);
      expect((await strangerSends(first)).status).toBe(409);
    });

    it('auto-approves only when the sender already manages the receiver', async () => {
      const file = await userFile(admin);
      const response = await adminFetch(
        post('/api/v1/me/inquiries', {
          type: InquiryType.transferArtifact,
          targetModel: InquiryResourceModel.Organization,
          targetOrganizationId: organization.id,
          content: { artifactId: file.id },
          status: 'sent',
        }),
      );
      expect(response.status).toBe(201);
      expect((await db.artifact.findUniqueOrThrow({ where: { id: file.id } })).ownerModel).toBe(
        'Organization',
      );

      const other = await userFile(member);
      await memberFetch(
        post('/api/v1/me/inquiries', {
          type: InquiryType.transferArtifact,
          targetModel: InquiryResourceModel.Organization,
          targetOrganizationId: organization.id,
          content: { artifactId: other.id },
          status: 'sent',
        }),
      );
      expect((await db.artifact.findUniqueOrThrow({ where: { id: other.id } })).ownerModel).toBe(
        'User',
      );
    });
  });

  describe('org-user folders', () => {
    it('a new membership gets its folder, granted to the membership', async () => {
      const { context } = await createOrganizationUser({ role: 'member' }, { organization });
      const folder = await findOrganizationUserFolder(organization.id, context.user.id);
      expect(folder?.kind).toBe('organizationUserFolder');
      const grants = await db.artifactPermission.findMany({ where: { artifactId: folder!.id } });
      expect(grants.map((grant) => grant.granteeModel)).toEqual(['OrganizationUser']);
    });

    it('another folder granted to the user is never mistaken for theirs', async () => {
      const joiner = (await createUser()).entity;
      const someone = (await createOrganizationUser({ role: 'member' }, { organization })).context
        .user;
      const theirs = await findOrganizationUserFolder(organization.id, someone.id);
      await createArtifactPermission({
        artifactId: theirs!.id,
        granteeModel: 'User',
        granteeUserId: joiner.id,
        role: 'owner',
      });
      await createOrganizationUser({ role: 'member' }, { organization, user: joiner });
      const own = await findOrganizationUserFolder(organization.id, joiner.id);
      expect(own).not.toBeNull();
      expect(own!.id).not.toBe(theirs!.id);
    });

    it('an invite creates it early with no grant; accepting grants the membership', async () => {
      const invitee = (await createUser()).entity;
      const response = await adminFetch(
        post(`/api/v1/organization/${organization.id}/inquiries`, {
          type: InquiryType.inviteOrganizationUser,
          targetModel: InquiryResourceModel.User,
          targetUserId: invitee.id,
          content: { role: 'member' },
          status: 'sent',
        }),
      );
      expect(response.status).toBe(201);
      const early = await findOrganizationUserFolder(organization.id, invitee.id);
      expect(early).not.toBeNull();
      expect(await db.artifactPermission.count({ where: { artifactId: early!.id } })).toBe(0);
      const { id: inquiryId } = (await json<{ id: string }>(response)).data;
      const inviteeFetch = createTestApp({ mockUser: invitee, mount }).fetch;
      expect(
        (await inviteeFetch(post(`/api/v1/inquiry/${inquiryId}/resolve`, { status: 'approved' })))
          .status,
      ).toBe(200);
      const grants = await db.artifactPermission.findMany({ where: { artifactId: early!.id } });
      expect(grants.map((grant) => grant.granteeModel)).toEqual(['OrganizationUser']);
    });
  });
});
