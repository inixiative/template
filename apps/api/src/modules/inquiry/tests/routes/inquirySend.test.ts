import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { Inquiry, Organization, OrganizationUser, User } from '@template/db';
import { InquiryResourceModel, InquiryStatus, InquiryType } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createInquiry,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import { inquiryRouter } from '#/modules/inquiry';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

const mount: MountFn[] = [(app) => app.route('/api/v1/inquiry', inquiryRouter)];

describe('POST /api/v1/inquiry/:id/send', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let admin: User;
  let org: Organization;
  let adminOrgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    admin = u;
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou } = await createOrganizationUser({ role: 'admin' }, { user: admin, organization: org });
    adminOrgUser = ou;

    const harness = createTestApp({ mockUser: admin, mockOrganizationUsers: [adminOrgUser], mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('sends a draft inquiry', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.draft,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
    });

    const response = await fetch(post(`/api/v1/inquiry/${inquiry.id}/send`));
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(200);
    expect(data.status).toBe(InquiryStatus.sent);
    expect(data.sentAt).toBeTruthy();
  });

  it('sets expiresAt when sending a draft', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.draft,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
    });

    const response = await fetch(post(`/api/v1/inquiry/${inquiry.id}/send`));
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(200);
    expect(data.expiresAt).not.toBeNull();
    expect(new Date(data.expiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it('returns target relations but not source relations in response', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.draft,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
    });

    const response = await fetch(post(`/api/v1/inquiry/${inquiry.id}/send`));
    const { data } = await json<Record<string, unknown>>(response);

    expect(response.status).toBe(200);
    expect(data.targetUser).toBeDefined();
    expect(data.sourceOrganization).toBeUndefined();
  });

  it('rejects sending an already sent inquiry', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
    });

    const response = await fetch(post(`/api/v1/inquiry/${inquiry.id}/send`));
    expect(response.status).toBe(400);
  });
});

describe('POST /api/v1/inquiry/:id/send — autoApprove', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;
  let admin: User;
  let adminOrgUser: OrganizationUser;
  const origAutoApprove = inquiryHandlers.inviteOrganizationUser.autoApprove;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    admin = u;
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou } = await createOrganizationUser({ role: 'admin' }, { user: admin, organization: org });
    adminOrgUser = ou;

    const harness = createTestApp({ mockUser: admin, mockOrganizationUsers: [adminOrgUser], mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  beforeEach(() => {
    inquiryHandlers.inviteOrganizationUser.autoApprove = async () => true;
  });

  afterEach(() => {
    inquiryHandlers.inviteOrganizationUser.autoApprove = origAutoApprove;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('auto-approves and returns status approved', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.draft,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
    });

    const response = await fetch(post(`/api/v1/inquiry/${inquiry.id}/send`));
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(200);
    expect(data.status).toBe(InquiryStatus.approved);
  });

  it('auto-approve uses the sent inquiry (not stale draft) when resolving', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.draft,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
    });

    await fetch(post(`/api/v1/inquiry/${inquiry.id}/send`));

    const record = await db.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
    expect(record.status).toBe(InquiryStatus.approved);
    expect(record.sentAt).not.toBeNull();
  });

  it('auto-approve runs handler side effects (creates OrganizationUser)', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.draft,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
    });

    const response = await fetch(post(`/api/v1/inquiry/${inquiry.id}/send`));
    expect(response.status).toBe(200);

    const membership = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: invitee.id } },
    });
    expect(membership).not.toBeNull();
    expect(membership?.role).toBe('member');
  });

  it('auto-approve response only contains target relations, not source', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.draft,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
    });

    const response = await fetch(post(`/api/v1/inquiry/${inquiry.id}/send`));
    const { data } = await json<Record<string, unknown>>(response);

    expect(data.targetUser).toBeDefined();
    expect(data.sourceOrganization).toBeUndefined();
  });

  it('auto-approve response matches the final sent-side inquiry record', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.draft,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
    });

    const response = await fetch(post(`/api/v1/inquiry/${inquiry.id}/send`));
    const { data } = await json<Record<string, unknown> & { auditLogsAsSubject?: unknown[] }>(response);

    const record = await db.inquiry.findUniqueOrThrow({
      where: { id: inquiry.id },
      include: {
        targetUser: true,
        targetOrganization: true,
        targetSpace: true,
        auditLogsAsSubject: true,
      },
    });

    expect(response.status).toBe(200);
    expect(data.status).toBe(record.status);
    expect(data.updatedAt).toBe(record.updatedAt.toISOString());
    expect(data.auditLogsAsSubject?.length).toBe(record.auditLogsAsSubject.length);
    expect(data.targetUser).toBeDefined();
  });
});
