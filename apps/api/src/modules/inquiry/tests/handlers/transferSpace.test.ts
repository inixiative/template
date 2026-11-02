import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { cache, cacheKey, checkCache, snapshotHookRegistry } from '@template/db';
import type { Organization, Space, User } from '@template/db/generated/client/client';
import {
  InquiryResourceModel,
  InquiryStatus,
  InquiryType,
  PlatformRole,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createEmailTemplate,
  createInquiry,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createProject,
  createSpace,
  createSpaceUser,
  createToken,
  createUser,
} from '@template/db/test';
import { registerAuditLogHook } from '#/hooks/auditLog/hook';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { registerEmailTemplateSlugReservationHook } from '#/hooks/emailTemplateSlugReservation/hook';
import { registerEmailVersioningHook } from '#/hooks/emailVersioning/hook';
import { registerDelegatedKeysHook } from '#/hooks/falsePolymorphism/delegatedKeysHook';
import { registerImmutableFieldsHook } from '#/hooks/immutableFields/hook';
import { registerMemberSelfGrantHook } from '#/hooks/memberSelfGrant/hook';
import { registerPreventHardDeleteHook } from '#/hooks/preventHardDelete/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import { inquiryRouter } from '#/modules/inquiry';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { post } from '#tests/utils/request';

describe('handler: transferSpace', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;
  let space: Space;
  let targetOrg1: Organization;
  let targetOrg2: Organization;
  let ownerFetch: ReturnType<typeof createTestApp>['fetch'];
  let adminFetch: ReturnType<typeof createTestApp>['fetch'];
  let restoreHooks: () => void;

  beforeAll(async () => {
    restoreHooks = snapshotHookRegistry();
    registerDelegatedKeysHook();
    registerMemberSelfGrantHook();
    registerRulesHook();
    registerAuditLogHook();
    registerClearCacheHook();
    registerEmailVersioningHook();
    registerEmailTemplateSlugReservationHook();
    registerImmutableFieldsHook();
    registerPreventHardDeleteHook();
    registerSoftDeleteCascadeHook();

    const { entity: owner } = await createUser();
    const { entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin });
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou, context: ouCtx } = await createOrganizationUser(
      { role: 'owner' },
      { user: owner, organization: org },
    );
    const { entity: s } = await createSpace({}, { organization: org });
    space = s;
    const { entity: su } = await createSpaceUser({ role: 'owner' }, { ...ouCtx, space });
    const { entity: to1 } = await createOrganization();
    targetOrg1 = to1;
    const { entity: to2 } = await createOrganization();
    targetOrg2 = to2;

    const ownerHarness = createTestApp({
      mockUser: owner,
      mockOrganizationUsers: [ou],
      mockSpaceUsers: [su],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });
    ownerFetch = ownerHarness.fetch;
    db = ownerHarness.db;

    adminFetch = createTestApp({
      mockUser: superadmin,
      mount: [(app) => app.route('/api/v1/inquiry', inquiryRouter)],
    }).fetch;
  });

  afterAll(async () => {
    restoreHooks();
    await cleanupTouchedTables(db);
  });

  const memberWithRows = async (sourceSpace: Space, alsoIn?: Organization) => {
    const { entity: user } = await createUser();
    const { entity: member, context } = await createOrganizationUser(
      { role: 'member' },
      { user, organization: org },
    );
    if (alsoIn) await createOrganizationUser({ role: 'member' }, { user, organization: alsoIn });
    const { entity: spaceUser } = await createSpaceUser(
      { role: 'admin' },
      { ...context, organizationUser: member, space: sourceSpace },
    );
    const { entity: integration } = await createIntegration({
      ownerModel: 'SpaceUser',
      organizationId: org.id,
      spaceId: sourceSpace.id,
      userId: user.id,
    });
    const { entity: token } = await createToken({ ownerModel: 'SpaceUser' }, { spaceUser });
    const { entity: emailTemplate } = await createEmailTemplate({
      ownerModel: 'SpaceUser',
      organizationId: org.id,
      spaceId: sourceSpace.id,
      userId: user.id,
    });
    const { entity: project } = await createProject({
      ownerModel: 'SpaceUser',
      organizationId: org.id,
      spaceId: sourceSpace.id,
      userId: user.id,
    });
    return { user, member, spaceUser, integration, token, emailTemplate, project };
  };

  const transferInquiry = async (sourceSpace: Space, target: Organization) =>
    (
      await createInquiry({
        type: InquiryType.transferSpace,
        status: InquiryStatus.sent,
        sourceModel: InquiryResourceModel.Space,
        sourceSpaceId: sourceSpace.id,
        targetModel: InquiryResourceModel.Organization,
        targetOrganizationId: target.id,
        content: {},
      })
    ).entity;

  const resolve = (
    inquiry: { id: string; updatedAt: Date },
    status: 'approved' | 'denied',
    resolution: { slug?: string } = {},
  ) =>
    adminFetch(
      post(`/api/v1/inquiry/${inquiry.id}/resolve`, {
        expectedUpdatedAt: new Date(inquiry.updatedAt).toISOString(),
        status,
        ...resolution,
      }),
    );

  const inviteBack = async (organization: Organization, user: User) => {
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: organization.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: user.id,
      content: { organizationId: organization.id, role: 'member' },
    });
    return createTestApp({
      mockUser: user,
      mount: [(app) => app.route('/api/v1/inquiry', inquiryRouter)],
    }).fetch(
      post(`/api/v1/inquiry/${inquiry.id}/resolve`, {
        expectedUpdatedAt: new Date(inquiry.updatedAt).toISOString(),
        status: 'approved',
      }),
    );
  };

  const withDeleted = <T>(read: () => Promise<T>) => db.withDeleted(read);

  it('rejects a second open transfer for the same space, even to a different target org', async () => {
    await transferInquiry(space, targetOrg1);

    const response = await ownerFetch(
      post(`/api/v1/space/${space.id}/inquiries`, {
        type: InquiryType.transferSpace,
        targetModel: InquiryResourceModel.Organization,
        targetOrganizationId: targetOrg2.id,
        content: {},
      }),
    );

    expect(response.status).toBe(409);
  });

  describe('approve', () => {
    let freshSpace: Space;
    let kept: Awaited<ReturnType<typeof memberWithRows>>;
    let dropped: Awaited<ReturnType<typeof memberWithRows>>;
    let removedEarlier: Awaited<ReturnType<typeof memberWithRows>>;
    let leftOldOrg: Awaited<ReturnType<typeof memberWithRows>>;
    let leftTargetOrg: Awaited<ReturnType<typeof memberWithRows>>;
    let leftTargetOrgAt: Date;
    let removedEarlierAt: Date;
    let spaceIntegrationId: string;
    let spaceTokenId: string;
    let integrationTokenId: string;
    let spaceEmailTemplateId: string;
    let spaceProjectId: string;
    let liveTargetMembersBefore: string[];

    beforeAll(async () => {
      const { entity: s } = await createSpace({}, { organization: org });
      freshSpace = s;
      kept = await memberWithRows(freshSpace, targetOrg1);
      dropped = await memberWithRows(freshSpace);
      removedEarlier = await memberWithRows(freshSpace);
      removedEarlierAt = (
        await db.spaceUser.update({
          where: { id: removedEarlier.spaceUser.id },
          data: { deletedAt: new Date(Date.now() - 60_000) },
        })
      ).deletedAt!;
      leftOldOrg = await memberWithRows(freshSpace);
      await db.organizationUser.update({
        where: { id: leftOldOrg.member.id },
        data: { deletedAt: new Date() },
      });
      leftTargetOrg = await memberWithRows(freshSpace);
      leftTargetOrgAt = new Date(Date.now() - 120_000);
      await createOrganizationUser(
        { role: 'member', deletedAt: leftTargetOrgAt },
        { user: leftTargetOrg.user, organization: targetOrg1 },
      );

      const { entity: spaceIntegration } = await createIntegration({
        ownerModel: 'Space',
        organizationId: org.id,
        spaceId: freshSpace.id,
      });
      spaceIntegrationId = spaceIntegration.id;
      integrationTokenId = (
        await createToken({ ownerModel: 'Integration' }, { integration: spaceIntegration })
      ).entity.id;
      spaceTokenId = (await createToken({ ownerModel: 'Space' }, { space: freshSpace })).entity.id;
      spaceEmailTemplateId = (
        await createEmailTemplate({
          ownerModel: 'Space',
          organizationId: org.id,
          spaceId: freshSpace.id,
        })
      ).entity.id;
      spaceProjectId = (
        await createProject({
          ownerModel: 'Space',
          organizationId: org.id,
          spaceId: freshSpace.id,
        })
      ).entity.id;
      liveTargetMembersBefore = (
        await db.organizationUser.findMany({ where: { organizationId: targetOrg1.id } })
      ).map(({ id }) => id);

      await cache(cacheKey('token', kept.token.id), async () => kept.token);
      await cache(cacheKey('integration', kept.integration.id), async () => kept.integration);

      const response = await resolve(await transferInquiry(freshSpace, targetOrg1), 'approved');
      expect(response.status).toBe(200);
    });

    it('clears the cached rows the transfer re-keyed', async () => {
      expect((await checkCache(cacheKey('token', kept.token.id))).state).toBe('empty');
      expect((await checkCache(cacheKey('integration', kept.integration.id))).state).toBe('empty');
    });

    it('moves the space to the target org', async () => {
      const transferred = await db.space.findUniqueOrThrow({ where: { id: freshSpace.id } });
      expect(transferred.organizationId).toBe(targetOrg1.id);
    });

    it('adds no live member to the target org', async () => {
      const after = await db.organizationUser.findMany({
        where: { organizationId: targetOrg1.id },
      });
      expect(after.map(({ id }) => id).sort()).toEqual([...liveTargetMembersBefore].sort());
    });

    it('keeps a member of the target org, with everything they own as that space member', async () => {
      const live = { organizationId: targetOrg1.id, deletedAt: null };
      expect(
        await db.spaceUser.findUniqueOrThrow({ where: { id: kept.spaceUser.id } }),
      ).toMatchObject(live);
      expect(
        await db.integration.findUniqueOrThrow({ where: { id: kept.integration.id } }),
      ).toMatchObject(live);
      expect(await db.token.findUniqueOrThrow({ where: { id: kept.token.id } })).toMatchObject({
        organizationId: targetOrg1.id,
      });
      expect(
        await db.emailTemplate.findUniqueOrThrow({ where: { id: kept.emailTemplate.id } }),
      ).toMatchObject(live);
      expect(await db.project.findUniqueOrThrow({ where: { id: kept.project.id } })).toMatchObject(
        live,
      );
    });

    it('tombstones every other member and everything downstream, keyed to the target org', async () => {
      const spaceUser = await withDeleted(() =>
        db.spaceUser.findUniqueOrThrow({ where: { id: dropped.spaceUser.id } }),
      );
      const stamp = spaceUser.deletedAt!;
      expect(stamp).toBeInstanceOf(Date);
      expect(spaceUser.organizationId).toBe(targetOrg1.id);
      for (const row of [
        await withDeleted(() =>
          db.integration.findUniqueOrThrow({ where: { id: dropped.integration.id } }),
        ),
        await withDeleted(() =>
          db.emailTemplate.findUniqueOrThrow({ where: { id: dropped.emailTemplate.id } }),
        ),
        await withDeleted(() =>
          db.project.findUniqueOrThrow({ where: { id: dropped.project.id } }),
        ),
      ])
        expect(row).toMatchObject({ organizationId: targetOrg1.id, deletedAt: stamp });
      expect(await db.token.findUnique({ where: { id: dropped.token.id } })).toBeNull();
    });

    it('gives each removed member a tombstoned membership in the target org that revives exactly what it should', async () => {
      const memberships = await withDeleted(() =>
        db.organizationUser.findMany({
          where: {
            organizationId: targetOrg1.id,
            userId: { in: [dropped.user.id, removedEarlier.user.id, leftOldOrg.user.id] },
          },
        }),
      );
      const stampOf = (userId: string) =>
        memberships.find((membership) => membership.userId === userId)?.deletedAt?.getTime();
      const spaceStampOf = async (id: string) =>
        (
          await withDeleted(() => db.spaceUser.findUniqueOrThrow({ where: { id } }))
        ).deletedAt!.getTime();
      expect(memberships).toHaveLength(3);
      expect(memberships.every((membership) => membership.role === 'member')).toBe(true);
      expect(stampOf(dropped.user.id)).toBe(await spaceStampOf(dropped.spaceUser.id));
      expect(stampOf(leftOldOrg.user.id)).toBe(await spaceStampOf(leftOldOrg.spaceUser.id));
      expect(stampOf(removedEarlier.user.id)).not.toBe(removedEarlierAt.getTime());
    });

    it('a member who had left the target org is removed with that membership, so rehiring them brings it back', async () => {
      const spaceUser = await withDeleted(() =>
        db.spaceUser.findUniqueOrThrow({ where: { id: leftTargetOrg.spaceUser.id } }),
      );
      expect(spaceUser.deletedAt?.getTime()).toBe(leftTargetOrgAt.getTime());

      expect((await inviteBack(targetOrg1, leftTargetOrg.user)).status).toBe(200);

      const live = { organizationId: targetOrg1.id, deletedAt: null };
      expect(
        await db.spaceUser.findUniqueOrThrow({ where: { id: leftTargetOrg.spaceUser.id } }),
      ).toMatchObject(live);
      expect(
        await db.integration.findUniqueOrThrow({ where: { id: leftTargetOrg.integration.id } }),
      ).toMatchObject(live);
      expect(
        await db.project.findUniqueOrThrow({ where: { id: leftTargetOrg.project.id } }),
      ).toMatchObject(live);
    });

    it('hiring someone a space admin had removed before the transfer leaves that removal in place', async () => {
      expect((await inviteBack(targetOrg1, removedEarlier.user)).status).toBe(200);

      expect(
        await withDeleted(() =>
          db.spaceUser.findUniqueOrThrow({ where: { id: removedEarlier.spaceUser.id } }),
        ),
      ).toMatchObject({ organizationId: targetOrg1.id, deletedAt: removedEarlierAt });
    });

    it('moves what the space owns, and the tokens of its integrations', async () => {
      const inTarget = { organizationId: targetOrg1.id, spaceId: freshSpace.id };
      expect(
        await db.integration.findUniqueOrThrow({ where: { id: spaceIntegrationId } }),
      ).toMatchObject(inTarget);
      expect(await db.token.findUniqueOrThrow({ where: { id: spaceTokenId } })).toMatchObject(
        inTarget,
      );
      expect(await db.token.findUniqueOrThrow({ where: { id: integrationTokenId } })).toMatchObject(
        inTarget,
      );
      expect(
        await db.emailTemplate.findUniqueOrThrow({ where: { id: spaceEmailTemplateId } }),
      ).toMatchObject(inTarget);
      expect(await db.project.findUniqueOrThrow({ where: { id: spaceProjectId } })).toMatchObject(
        inTarget,
      );
    });

    it('an old-org re-invite revives nothing in the moved space', async () => {
      expect((await inviteBack(org, leftOldOrg.user)).status).toBe(200);

      expect(
        await db.organizationUser.findFirst({
          where: { organizationId: org.id, userId: leftOldOrg.user.id },
        }),
      ).not.toBeNull();
      expect(
        await withDeleted(() =>
          db.spaceUser.findUniqueOrThrow({ where: { id: leftOldOrg.spaceUser.id } }),
        ),
      ).toMatchObject({ organizationId: targetOrg1.id, deletedAt: expect.any(Date) });
      expect(
        await db.integration.findUnique({ where: { id: leftOldOrg.integration.id } }),
      ).toBeNull();
      expect(await db.project.findUnique({ where: { id: leftOldOrg.project.id } })).toBeNull();
    });

    it('reviving the target-org membership brings their space membership and its rows back', async () => {
      expect((await inviteBack(targetOrg1, dropped.user)).status).toBe(200);

      const live = { organizationId: targetOrg1.id, deletedAt: null };
      expect(
        await db.spaceUser.findUniqueOrThrow({ where: { id: dropped.spaceUser.id } }),
      ).toMatchObject(live);
      expect(
        await db.integration.findUniqueOrThrow({ where: { id: dropped.integration.id } }),
      ).toMatchObject(live);
      expect(
        await db.emailTemplate.findUniqueOrThrow({ where: { id: dropped.emailTemplate.id } }),
      ).toMatchObject(live);
      expect(
        await db.project.findUniqueOrThrow({ where: { id: dropped.project.id } }),
      ).toMatchObject(live);
    });
  });

  it('refuses a transfer into an org that already has the slug, and changes nothing', async () => {
    const { entity: freshSpace } = await createSpace({}, { organization: org });
    await createSpace({ slug: freshSpace.slug }, { organization: targetOrg2 });
    const member = await memberWithRows(freshSpace);

    const response = await resolve(await transferInquiry(freshSpace, targetOrg2), 'approved');

    expect(response.status).toBe(409);
    expect(
      (await db.space.findUniqueOrThrow({ where: { id: freshSpace.id } })).organizationId,
    ).toBe(org.id);
    expect(
      await db.spaceUser.findUniqueOrThrow({ where: { id: member.spaceUser.id } }),
    ).toMatchObject({ organizationId: org.id, deletedAt: null });
  });

  it('an approver renames a space whose slug the target org already holds', async () => {
    const { entity: freshSpace } = await createSpace({}, { organization: org });
    await createSpace({ slug: freshSpace.slug }, { organization: targetOrg2 });
    const slug = `${freshSpace.slug}-moved`;

    const response = await resolve(await transferInquiry(freshSpace, targetOrg2), 'approved', {
      slug,
    });

    expect(response.status).toBe(200);
    expect(await db.space.findUniqueOrThrow({ where: { id: freshSpace.id } })).toMatchObject({
      organizationId: targetOrg2.id,
      slug,
    });
  });

  it('refuses a rename onto a slug the target org already holds', async () => {
    const { entity: freshSpace } = await createSpace({}, { organization: org });
    const { entity: taken } = await createSpace({}, { organization: targetOrg2 });

    const response = await resolve(await transferInquiry(freshSpace, targetOrg2), 'approved', {
      slug: taken.slug,
    });

    expect(response.status).toBe(409);
    expect(await db.space.findUniqueOrThrow({ where: { id: freshSpace.id } })).toMatchObject({
      organizationId: org.id,
      slug: freshSpace.slug,
    });
  });

  it('deny changes nothing', async () => {
    const { entity: freshSpace } = await createSpace({}, { organization: org });
    const kept = await memberWithRows(freshSpace, targetOrg1);
    const dropped = await memberWithRows(freshSpace);

    await resolve(await transferInquiry(freshSpace, targetOrg1), 'denied');

    const unchanged = await db.space.findUniqueOrThrow({ where: { id: freshSpace.id } });
    expect(unchanged.organizationId).toBe(org.id);
    for (const member of [kept, dropped]) {
      const live = { organizationId: org.id, deletedAt: null };
      expect(
        await db.spaceUser.findUniqueOrThrow({ where: { id: member.spaceUser.id } }),
      ).toMatchObject(live);
      expect(
        await db.integration.findUniqueOrThrow({ where: { id: member.integration.id } }),
      ).toMatchObject(live);
      expect(await db.token.findUnique({ where: { id: member.token.id } })).not.toBeNull();
    }
    expect(
      await db.organizationUser.findFirst({
        where: { organizationId: targetOrg1.id, userId: dropped.user.id },
      }),
    ).toBeNull();
  });
});
