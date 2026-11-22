import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type {
  Integration,
  Organization,
  OrganizationUser,
  Project,
  ProjectIntegration,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import {
  AuditAction,
  AuditSubjectModel,
  InquiryStatus,
  InquiryType,
  Role,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createInquiry,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createProject,
  createProjectIntegration,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import { inquiryRouter } from '#/modules/inquiry';
import { projectRouter } from '#/modules/project';
import {
  adminProjectIntegrationRouter,
  projectIntegrationRouter,
} from '#/modules/projectIntegration';
import { createTestApp } from '#tests/createTestApp';
import { del, get, parseSuccessBody, post } from '#tests/utils/request';

const appFor = (
  user: User,
  organizationUsers: OrganizationUser[],
  spaceUsers: SpaceUser[] = [],
  options?: { superadmin?: boolean },
) =>
  createTestApp({
    mockUser: options?.superadmin ? { ...user, platformRole: 'superadmin' } : user,
    mockOrganizationUsers: organizationUsers,
    mockSpaceUsers: spaceUsers,
    mount: [
      (app) => app.route('/api/v1/project', projectRouter),
      (app) => app.route('/api/v1/projectIntegration', projectIntegrationRouter),
      (app) => app.route('/api/v1/inquiry', inquiryRouter),
      (app) => app.route('/api/admin/projectIntegration', adminProjectIntegrationRouter),
    ],
  });

describe('ProjectIntegration CRUD, tenant boundary hook, ReBAC, AuditLog, and space transfer', () => {
  let owner: User;
  let organization: Organization;
  let ownerMember: OrganizationUser;
  let space: Space;
  let ownerSpaceMember: SpaceUser;
  let orgProject: Project;
  let orgIntegration: Integration;
  let ownerApp: ReturnType<typeof createTestApp>;

  beforeEach(async () => {
    const created = await createOrganizationUser({ role: Role.owner });
    ownerMember = created.entity;
    owner = created.context.user;
    organization = created.context.organization;
    space = (await createSpace({}, { organization })).entity;
    ownerSpaceMember = (
      await createSpaceUser(
        { role: Role.owner },
        { organization, user: owner, organizationUser: ownerMember, space },
      )
    ).entity;
    orgProject = (
      await createProject({ ownerModel: 'Organization', organizationId: organization.id })
    ).entity;
    orgIntegration = (
      await createIntegration({ ownerModel: 'Organization', organizationId: organization.id })
    ).entity;
    ownerApp = appFor(owner, [ownerMember], [ownerSpaceMember]);
  });

  afterEach(async () => {
    await cleanupTouchedTables(ownerApp.db);
  });

  it('creates, lists, reads, admin-lists, rejects duplicates (409), soft-deletes, and audits ProjectIntegration with parent tenancy', async () => {
    const createdRes = await ownerApp.fetch(
      post(`/api/v1/project/${orgProject.id}/projectIntegrations`, {
        integrationId: orgIntegration.id,
      }),
    );
    expect(createdRes.status).toBe(201);
    const { data: link } = await parseSuccessBody<ProjectIntegration>(createdRes);
    expect(link.projectId).toBe(orgProject.id);
    expect(link.integrationId).toBe(orgIntegration.id);

    // Duplicate link returns 409
    const duplicate = await ownerApp.fetch(
      post(`/api/v1/project/${orgProject.id}/projectIntegrations`, {
        integrationId: orgIntegration.id,
      }),
    );
    expect(duplicate.status).toBe(409);

    // List under project
    const listRes = await ownerApp.fetch(
      get(`/api/v1/project/${orgProject.id}/projectIntegrations`),
    );
    expect(listRes.status).toBe(200);
    const { data: listed } = await parseSuccessBody<ProjectIntegration[]>(listRes);
    expect(listed.map((r) => r.id)).toEqual([link.id]);

    // Read by ID
    const readRes = await ownerApp.fetch(get(`/api/v1/projectIntegration/${link.id}`));
    expect(readRes.status).toBe(200);

    // Admin paginated listing
    const superadminApp = appFor(owner, [ownerMember], [ownerSpaceMember], { superadmin: true });
    const adminList = await superadminApp.fetch(get('/api/admin/projectIntegration'));
    expect(adminList.status).toBe(200);
    const { data: adminRows } = await parseSuccessBody<ProjectIntegration[]>(adminList);
    expect(adminRows.some((r) => r.id === link.id)).toBe(true);

    // Soft-delete frees the unique constraint
    const delRes = await ownerApp.fetch(del(`/api/v1/projectIntegration/${link.id}`));
    expect(delRes.status).toBe(204);
    expect((await ownerApp.fetch(get(`/api/v1/projectIntegration/${link.id}`))).status).toBe(404);

    // AuditLog recorded create & delete with contextOrganizationId resolved through ProjectIntegration -> Project
    const logs = await ownerApp.db.auditLog.findMany({
      where: {
        subjectModel: AuditSubjectModel.ProjectIntegration,
        subjectProjectIntegrationId: link.id,
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.map((l) => l.action)).toEqual([AuditAction.create, AuditAction.delete]);
    expect(logs[0]?.contextOrganizationId).toBe(organization.id);
  });

  it('enforces tenant-boundary DB hook: blocks cross-org, personal/org mixing, cross-user, and upward/sideways space leaks while allowing org integration on space project', async () => {
    const { entity: otherOrg } = await createOrganization();
    const { entity: otherOrgIntegration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: otherOrg.id,
    });
    const { entity: personalProject } = await createProject({
      ownerModel: 'User',
      userId: owner.id,
    });
    const { entity: otherUser } = await createUser();
    const { entity: otherUserIntegration } = await createIntegration({
      ownerModel: 'User',
      userId: otherUser.id,
    });
    const { entity: spaceAProject } = await createProject({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: space.id,
    });
    const { entity: spaceAIntegration } = await createIntegration({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: space.id,
    });
    const { entity: spaceB } = await createSpace({}, { organization });
    const { entity: spaceBProject } = await createProject({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: spaceB.id,
    });

    // Cross-org rejected
    await expect(
      createProjectIntegration({}, { project: orgProject, integration: otherOrgIntegration }),
    ).rejects.toThrow(/same organization/);

    // Personal project + Org integration rejected
    await expect(
      createProjectIntegration({}, { project: personalProject, integration: orgIntegration }),
    ).rejects.toThrow(/same organization/);

    // Cross-user personal rejected
    await expect(
      createProjectIntegration({}, { project: personalProject, integration: otherUserIntegration }),
    ).rejects.toThrow(/same user/);

    // Space A integration cannot attach upward to Org project or sideways to Space B project
    await expect(
      createProjectIntegration({}, { project: orgProject, integration: spaceAIntegration }),
    ).rejects.toThrow(/same space/);
    await expect(
      createProjectIntegration({}, { project: spaceBProject, integration: spaceAIntegration }),
    ).rejects.toThrow(/same space/);

    // Org integration (spaceId: null) CAN attach to Space A project in the same org
    const { entity: allowed } = await createProjectIntegration(
      {},
      { project: spaceAProject, integration: orgIntegration },
    );
    expect(allowed.projectId).toBe(spaceAProject.id);
    expect(allowed.integrationId).toBe(orgIntegration.id);

    // OrganizationUser integration cannot attach upward to Org project or sideways to another user's OrgUser project
    const member1 = await createOrganizationUser({ role: Role.member }, { organization });
    const member2 = await createOrganizationUser({ role: Role.member }, { organization });
    const { entity: orgUser1Integration } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: member1.context.user.id,
    });
    const { entity: orgUser2Project } = await createProject({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: member2.context.user.id,
    });
    const { entity: orgUser1Project } = await createProject({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: member1.context.user.id,
    });

    await expect(
      createProjectIntegration({}, { project: orgProject, integration: orgUser1Integration }),
    ).rejects.toThrow(/same user/);
    await expect(
      createProjectIntegration({}, { project: orgUser2Project, integration: orgUser1Integration }),
    ).rejects.toThrow(/same user/);
    const { entity: sameOrgUserAllowed } = await createProjectIntegration(
      {},
      { project: orgUser1Project, integration: orgUser1Integration },
    );
    expect(sameOrgUserAllowed.projectId).toBe(orgUser1Project.id);

    // SpaceUser integration cannot attach upward to Space project or sideways to another user's SpaceUser project
    const spaceMember1 = await createSpaceUser(
      { role: Role.member },
      {
        organization,
        space,
        user: member1.context.user,
        organizationUser: member1.entity,
      },
    );
    const spaceMember2 = await createSpaceUser(
      { role: Role.member },
      {
        organization,
        space,
        user: member2.context.user,
        organizationUser: member2.entity,
      },
    );
    const { entity: spaceUser1Integration } = await createIntegration({
      ownerModel: 'SpaceUser',
      organizationId: organization.id,
      spaceId: space.id,
      userId: spaceMember1.context.user.id,
    });
    const { entity: spaceUser2Project } = await createProject({
      ownerModel: 'SpaceUser',
      organizationId: organization.id,
      spaceId: space.id,
      userId: spaceMember2.context.user.id,
    });
    const { entity: spaceUser1Project } = await createProject({
      ownerModel: 'SpaceUser',
      organizationId: organization.id,
      spaceId: space.id,
      userId: spaceMember1.context.user.id,
    });

    await expect(
      createProjectIntegration({}, { project: spaceAProject, integration: spaceUser1Integration }),
    ).rejects.toThrow(/same user/);
    await expect(
      createProjectIntegration(
        {},
        { project: spaceUser2Project, integration: spaceUser1Integration },
      ),
    ).rejects.toThrow(/same user/);
    const { entity: sameSpaceUserAllowed } = await createProjectIntegration(
      {},
      { project: spaceUser1Project, integration: spaceUser1Integration },
    );
    expect(sameSpaceUserAllowed.projectId).toBe(spaceUser1Project.id);

    // Updating projectId or integrationId on an existing ProjectIntegration is refused with 422
    await expect(
      ownerApp.db.projectIntegration.update({
        where: { id: allowed.id },
        data: { projectId: orgProject.id },
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      ownerApp.db.projectIntegration.update({
        where: { id: allowed.id },
        data: { integrationId: spaceAIntegration.id },
      }),
    ).rejects.toMatchObject({ status: 422 });

    // Batched createManyAndReturn validates one project with many integrations via IN queries
    const { entity: secondOrgIntegration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const bulkCreated = await ownerApp.db.projectIntegration.createManyAndReturn({
      data: [
        { projectId: orgProject.id, integrationId: orgIntegration.id },
        { projectId: orgProject.id, integrationId: secondOrgIntegration.id },
      ],
    });
    expect(bulkCreated).toHaveLength(2);

    await expect(
      ownerApp.db.projectIntegration.createManyAndReturn({
        data: [
          { projectId: spaceAProject.id, integrationId: secondOrgIntegration.id },
          { projectId: spaceAProject.id, integrationId: otherOrgIntegration.id },
        ],
      }),
    ).rejects.toThrow(/same organization/);
  });

  it('enforces ReBAC: member cannot link org project, member can link own member project to org integration, and org admin can delete that link', async () => {
    const memberCreated = await createOrganizationUser({ role: Role.member }, { organization });
    const adminCreated = await createOrganizationUser({ role: Role.admin }, { organization });
    const memberApp = appFor(memberCreated.context.user, [memberCreated.entity]);
    const adminApp = appFor(adminCreated.context.user, [adminCreated.entity]);

    // Member lacks project:manage on orgProject -> 403
    expect(
      (
        await memberApp.fetch(
          post(`/api/v1/project/${orgProject.id}/projectIntegrations`, {
            integrationId: orgIntegration.id,
          }),
        )
      ).status,
    ).toBe(403);

    // Member owns memberProject and has integration:operate on orgIntegration -> 201
    const { entity: memberProject } = await createProject({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: memberCreated.context.user.id,
    });
    const linkRes = await memberApp.fetch(
      post(`/api/v1/project/${memberProject.id}/projectIntegrations`, {
        integrationId: orgIntegration.id,
      }),
    );
    expect(linkRes.status).toBe(201);
    const { data: memberLink } = await parseSuccessBody<ProjectIntegration>(linkRes);

    // Org admin manages orgIntegration -> can delete the link via integration:manage!
    expect((await adminApp.fetch(del(`/api/v1/projectIntegration/${memberLink.id}`))).status).toBe(
      204,
    );
  });

  it('space transfer from Org A to Org B tombstones Org A ProjectIntegration links while preserving space-scoped integration links', async () => {
    const { entity: orgBOwnerMember, context: orgBCtx } = await createOrganizationUser({
      role: Role.owner,
    });
    const orgB = orgBCtx.organization;
    const orgBApp = appFor(orgBCtx.user, [orgBOwnerMember]);

    const { entity: spaceProject } = await createProject({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: space.id,
    });
    const { entity: spaceIntegration } = await createIntegration({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: space.id,
    });

    const { entity: orgLink } = await createProjectIntegration(
      {},
      { project: spaceProject, integration: orgIntegration },
    );
    const { entity: spaceLink } = await createProjectIntegration(
      {},
      { project: spaceProject, integration: spaceIntegration },
    );

    const { entity: transferInquiry } = await createInquiry({
      type: InquiryType.transferSpace,
      status: InquiryStatus.sent,
      sourceModel: 'Space',
      sourceId: space.id,
      sourceOrganizationId: organization.id,
      sourceSpaceId: space.id,
      targetModel: 'Organization',
      targetId: orgB.id,
      targetOrganizationId: orgB.id,
      content: { slug: space.slug },
    });

    const resolveRes = await orgBApp.fetch(
      post(`/api/v1/inquiry/${transferInquiry.id}/resolve`, {
        expectedUpdatedAt: new Date(transferInquiry.updatedAt).toISOString(),
        status: InquiryStatus.approved,
      }),
    );
    expect(resolveRes.status).toBe(200);

    // Org A integration link is tombstoned; Space integration link survives in Org B!
    const liveOrgLink = await ownerApp.db.projectIntegration.findFirst({
      where: { id: orgLink.id },
    });
    expect(liveOrgLink).toBeNull();

    const tombstonedOrgLink = await ownerApp.db.withDeleted(() =>
      ownerApp.db.projectIntegration.findUnique({ where: { id: orgLink.id } }),
    );
    expect(tombstonedOrgLink?.deletedAt).toBeInstanceOf(Date);

    const survivingSpaceLink = await ownerApp.db.projectIntegration.findFirst({
      where: { id: spaceLink.id },
    });
    expect(survivingSpaceLink).not.toBeNull();
  });
});
