import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Organization, OrganizationUser, User } from '@template/db/generated/client/client';
import {
  AuditSubjectModel,
  ContactType,
  InquiryResourceModel,
  InquiryStatus,
  InquiryType,
  PlatformRole,
  Role,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createAccount,
  createArtifactPermission,
  createAuditLog,
  createContact,
  createCustomerRelationship,
  createInquiry,
  createOrganization,
  createOrganizationUser,
  createRuleReference,
  createSegment,
  createSession,
  createSetting,
  createTag,
  createTagCategory,
  createToken,
  createUser,
} from '@template/db/test';
import { inquiryRouter } from '#/modules/inquiry';
import { mergeUserService } from '#/modules/inquiry/services/mergeUser';
import { createTestApp } from '#tests/createTestApp';
import { post } from '#tests/utils/request';

describe('handler: mergeUser', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let adminFetch: ReturnType<typeof createTestApp>['fetch'];
  let source: User;
  let target: User;
  let onlySourceOrg: Organization;
  let sharedOrg: Organization;
  let sourceSoloMember: OrganizationUser;
  let sourceSharedMember: OrganizationUser;
  let targetSharedMember: OrganizationUser;

  beforeEach(async () => {
    const { entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin });
    const harness = createTestApp({
      mockUser: superadmin,
      mount: [(app) => app.route('/api/v1/inquiry', inquiryRouter)],
    });
    adminFetch = harness.fetch;
    db = harness.db;

    source = (await createUser()).entity;
    target = (await createUser()).entity;
    onlySourceOrg = (await createOrganization()).entity;
    sharedOrg = (await createOrganization()).entity;
    sourceSoloMember = (
      await createOrganizationUser(
        { role: Role.owner },
        { user: source, organization: onlySourceOrg },
      )
    ).entity;
    sourceSharedMember = (
      await createOrganizationUser({ role: Role.admin }, { user: source, organization: sharedOrg })
    ).entity;
    targetSharedMember = (
      await createOrganizationUser({ role: Role.member }, { user: target, organization: sharedOrg })
    ).entity;
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  const content = () => ({ sourceUser: { id: source.id, email: source.email } });

  const createMergeInquiry = async () =>
    (
      await createInquiry({
        type: InquiryType.mergeUser,
        status: InquiryStatus.sent,
        sourceModel: InquiryResourceModel.User,
        sourceUserId: source.id,
        targetModel: InquiryResourceModel.User,
        targetUserId: target.id,
        content: content(),
      })
    ).entity;

  const resolve = (
    inquiry: { id: string; updatedAt: Date },
    resolution: Record<string, unknown> = content(),
    status = 'approved',
  ) =>
    adminFetch(
      post(`/api/v1/inquiry/${inquiry.id}/resolve`, {
        expectedUpdatedAt: new Date(inquiry.updatedAt).toISOString(),
        status,
        ...resolution,
      }),
    );

  it('moves the source user’s rows to the target, keeps the target’s where both hold one, and deletes the source', async () => {
    const { entity: token } = await createToken({ ownerModel: 'User' }, { user: source });
    const { entity: memberSetting } = await createSetting(
      { resourceModel: 'OrganizationUser', key: 'general.displayLocale', valueText: 'fr' },
      { organizationUser: sourceSharedMember },
    );
    const { entity: sourceTimezone } = await createSetting(
      { resourceModel: 'User', key: 'general.defaultTimezone', valueText: 'Asia/Tokyo' },
      { user: source },
    );
    const { entity: targetTimezone } = await createSetting(
      { resourceModel: 'User', key: 'general.defaultTimezone', valueText: 'UTC' },
      { user: target },
    );
    const inquiry = await createMergeInquiry();

    const response = await resolve(inquiry);

    expect(response.status).toBe(200);
    expect(await db.user.findUnique({ where: { id: source.id } })).toBeNull();
    const memberships = await db.organizationUser.findMany({ where: { userId: target.id } });
    expect(
      memberships.map(({ id, role }) => ({ id, role })).sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual(
      [
        { id: sourceSoloMember.id, role: Role.owner },
        { id: targetSharedMember.id, role: Role.member },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(await db.token.findUniqueOrThrow({ where: { id: token.id } })).toMatchObject({
      userId: target.id,
    });
    expect(await db.setting.findUniqueOrThrow({ where: { id: memberSetting.id } })).toMatchObject({
      resourceUserId: target.id,
      resourceOrganizationId: sharedOrg.id,
      resourceId: targetSharedMember.id,
    });
    expect(
      await db.withDeleted(() => db.setting.findUnique({ where: { id: sourceTimezone.id } })),
    ).toBeNull();
    expect(await db.setting.findUniqueOrThrow({ where: { id: targetTimezone.id } })).toMatchObject({
      valueText: 'UTC',
    });
    const resolved = await db.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
    expect(resolved).toMatchObject({
      status: InquiryStatus.approved,
      sourceUserId: target.id,
      resolution: content(),
    });
  });

  it('orphans the source user’s audit columns and repoints logs about their memberships', async () => {
    const { entity: aboutTheSource } = await createAuditLog({
      subjectModel: AuditSubjectModel.User,
      subjectId: source.id,
      subjectUserId: source.id,
      actorUserId: source.id,
      componentVersions: {},
    });
    const { entity: aboutTheSoloMembership } = await createAuditLog({
      subjectModel: AuditSubjectModel.OrganizationUser,
      subjectId: sourceSoloMember.id,
      subjectOrganizationId: onlySourceOrg.id,
      subjectUserId: source.id,
      actorUserId: source.id,
      componentVersions: {},
    });
    const { entity: aboutTheSharedMembership } = await createAuditLog({
      subjectModel: AuditSubjectModel.OrganizationUser,
      subjectId: sourceSharedMember.id,
      subjectOrganizationId: sharedOrg.id,
      subjectUserId: source.id,
      componentVersions: {},
    });
    const inquiry = await createMergeInquiry();

    expect((await resolve(inquiry)).status).toBe(200);

    expect(await db.auditLog.findUniqueOrThrow({ where: { id: aboutTheSource.id } })).toMatchObject(
      {
        subjectId: source.id,
        subjectUserId: null,
        actorUserId: null,
      },
    );
    expect(
      await db.auditLog.findUniqueOrThrow({ where: { id: aboutTheSoloMembership.id } }),
    ).toMatchObject({
      subjectId: sourceSoloMember.id,
      subjectUserId: target.id,
      actorUserId: null,
    });
    expect(
      await db.auditLog.findUniqueOrThrow({ where: { id: aboutTheSharedMembership.id } }),
    ).toMatchObject({ subjectId: targetSharedMember.id, subjectUserId: target.id });
  });

  it('refuses an approval that names a different user than the request', async () => {
    const inquiry = await createMergeInquiry();

    const response = await resolve(inquiry, { sourceUser: { id: target.id, email: target.email } });

    expect(response.status).toBe(422);
    expect(await db.user.findUnique({ where: { id: source.id } })).not.toBeNull();
  });

  it('refuses when the source user changed email after the request', async () => {
    const inquiry = await createMergeInquiry();
    await db.user.update({ where: { id: source.id }, data: { email: `moved-${source.email}` } });

    const response = await resolve(inquiry);

    expect(response.status).toBe(409);
  });

  it('refuses a merge of a user into themselves, or one the sender is not the source user of', async () => {
    const sides = {
      sourceModel: InquiryResourceModel.User,
      targetModel: InquiryResourceModel.User,
    } as const;

    await expect(
      mergeUserService.validate!(
        { ...sides, sourceUserId: source.id, targetUserId: source.id },
        content(),
      ),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      mergeUserService.validate!(
        { ...sides, sourceUserId: target.id, targetUserId: source.id },
        content(),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('moves a tag in a category both users hold into the target’s category, and keeps the target’s tag of the same name', async () => {
    const category = (user: User) =>
      createTagCategory({ ownerModel: 'User', name: 'audience' }, { user });
    const { entity: sourceCategory } = await category(source);
    const { entity: targetCategory } = await category(target);
    const tag = (user: User, tagCategoryId: string, name: string) =>
      createTag({ ownerModel: 'User', tagCategoryId, name }, { user });
    const { entity: onlySourceTag } = await tag(source, sourceCategory.id, 'founders');
    const { entity: sourceSharedTag } = await tag(source, sourceCategory.id, 'investors');
    const { entity: targetSharedTag } = await tag(target, targetCategory.id, 'investors');
    const inquiry = await createMergeInquiry();

    expect((await resolve(inquiry)).status).toBe(200);

    expect(await db.tag.findUniqueOrThrow({ where: { id: onlySourceTag.id } })).toMatchObject({
      userId: target.id,
      tagCategoryId: targetCategory.id,
    });
    expect(await db.tag.findUniqueOrThrow({ where: { id: targetSharedTag.id } })).toMatchObject({
      tagCategoryId: targetCategory.id,
    });
    expect(
      await db.withDeleted(() => db.tag.findUnique({ where: { id: sourceSharedTag.id } })),
    ).toBeNull();
    expect(
      await db.withDeleted(() => db.tagCategory.findUnique({ where: { id: sourceCategory.id } })),
    ).toBeNull();
  });

  it('deletes the source user’s password and sessions with it, and moves its other sign-in accounts', async () => {
    const { entity: password } = await createAccount({
      userId: source.id,
      providerId: 'credential',
    });
    const { entity: google } = await createAccount({ userId: source.id, providerId: 'google' });
    const { entity: session } = await createSession({ userId: source.id });
    const inquiry = await createMergeInquiry();

    expect((await resolve(inquiry)).status).toBe(200);

    expect(await db.account.findUnique({ where: { id: password.id } })).toBeNull();
    expect(await db.session.findUnique({ where: { id: session.id } })).toBeNull();
    expect(await db.account.findUniqueOrThrow({ where: { id: google.id } })).toMatchObject({
      userId: target.id,
    });
  });

  it('denies without naming the source user, and merges nothing', async () => {
    const inquiry = await createMergeInquiry();

    const response = await resolve(inquiry, {}, 'denied');

    expect(response.status).toBe(200);
    expect(await db.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } })).toMatchObject({
      status: InquiryStatus.denied,
    });
    expect(await db.user.findUnique({ where: { id: source.id } })).not.toBeNull();
  });

  it('cancels an open inquiry the merge leaves running from the target to itself', async () => {
    const { entity: reverse } = await createInquiry({
      type: InquiryType.mergeUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.User,
      sourceUserId: target.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: source.id,
      content: { sourceUser: { id: target.id, email: target.email } },
    });
    const inquiry = await createMergeInquiry();

    expect((await resolve(inquiry)).status).toBe(200);

    expect(await db.inquiry.findUniqueOrThrow({ where: { id: reverse.id } })).toMatchObject({
      sourceUserId: target.id,
      targetUserId: target.id,
      status: InquiryStatus.canceled,
    });
  });

  it('keeps the self-grant of every membership the target ends with', async () => {
    const inquiry = await createMergeInquiry();

    expect((await resolve(inquiry)).status).toBe(200);

    for (const member of [sourceSoloMember, targetSharedMember])
      expect(
        await db.entitlement.findFirst({
          where: {
            sourceModel: 'OrganizationUser',
            targetModel: 'OrganizationUser',
            targetId: member.id,
          },
        }),
      ).toMatchObject({ targetUserId: target.id, deletedAt: null });
  });

  it('lets a live source membership replace one the target had removed', async () => {
    const { entity: organization } = await createOrganization();
    await createOrganizationUser({ role: Role.owner }, { user: source, organization });
    const { entity: removed } = await createOrganizationUser(
      { role: Role.member },
      { user: target, organization },
    );
    await db.organizationUser.update({
      where: { id: removed.id },
      data: { deletedAt: new Date() },
    });
    const inquiry = await createMergeInquiry();

    expect((await resolve(inquiry)).status).toBe(200);

    expect(
      await db.organizationUser.findMany({
        where: { userId: target.id, organizationId: organization.id },
      }),
    ).toMatchObject([{ role: Role.owner, deletedAt: null }]);
  });

  it('places the source’s contacts after the target’s, with no two at one position', async () => {
    await createContact({ ownerModel: 'User' }, { user: source });
    await createContact({ ownerModel: 'User' }, { user: source });
    await createContact({ ownerModel: 'User' }, { user: target });
    const inquiry = await createMergeInquiry();

    expect((await resolve(inquiry)).status).toBe(200);

    const contacts = await db.contact.findMany({
      where: { userId: target.id, type: ContactType.email },
      orderBy: { position: 'asc' },
    });
    expect(contacts.map(({ position }) => position)).toEqual(contacts.map((_, index) => index + 1));
  });

  it('merges a segment rule that names both users into one reference to the target', async () => {
    const { entity: segment } = await createSegment({ ownerModel: 'User' }, { user: target });
    for (const user of [source, target])
      await createRuleReference({
        sourceModel: 'Segment',
        sourceSegmentId: segment.id,
        targetModel: 'User',
        targetUserId: user.id,
      });
    const inquiry = await createMergeInquiry();

    expect((await resolve(inquiry)).status).toBe(200);

    expect(
      await db.ruleReference.findMany({
        where: { sourceSegmentId: segment.id, targetModel: 'User' },
      }),
    ).toMatchObject([{ targetUserId: target.id }]);
  });

  it('removes a customer relationship between the two users', async () => {
    const { entity: relationship } = await createCustomerRelationship({
      customerModel: 'User',
      customerUserId: source.id,
      providerModel: 'User',
      providerUserId: target.id,
    });
    const inquiry = await createMergeInquiry();

    expect((await resolve(inquiry)).status).toBe(200);

    expect(
      await db.withDeleted(() =>
        db.customerRelationship.findUnique({ where: { id: relationship.id } }),
      ),
    ).toMatchObject({ customerUserId: target.id, deletedAt: expect.any(Date) });
  });

  it('never moves a grant on the source’s root onto the target’s root', async () => {
    const { entity: grantee } = await createUser();
    const rootOf = (user: User) =>
      db.artifact.findFirstOrThrow({ where: { userId: user.id, kind: 'root' } });
    const [sourceRoot, targetRoot] = [await rootOf(source), await rootOf(target)];
    await createArtifactPermission({
      artifactId: sourceRoot.id,
      granteeModel: 'User',
      granteeUserId: grantee.id,
      role: Role.member,
    });
    const inquiry = await createMergeInquiry();

    expect((await resolve(inquiry)).status).toBe(200);

    expect(
      await db.artifactPermission.findMany({
        where: { artifactId: targetRoot.id, granteeUserId: grantee.id },
      }),
    ).toEqual([]);
  });
});
