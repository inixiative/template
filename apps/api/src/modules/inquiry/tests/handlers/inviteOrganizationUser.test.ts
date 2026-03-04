import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Inquiry, Organization, User } from '@template/db';
import { InquiryResourceModel, InquiryStatus, InquiryType } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createInquiry,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import { inquiryRouter } from '#/modules/inquiry';
import { createTestApp } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

const mount = [(app: any) => app.route('/api/v1/inquiry', inquiryRouter)];

describe('handler: inviteOrganizationUser', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;

  beforeAll(async () => {
    const { entity: sourceUser } = await createUser();
    const { entity: o } = await createOrganization();
    org = o;
    await createOrganizationUser({ role: 'admin' }, { user: sourceUser, organization: org });

    db = createTestApp({ mockUser: sourceUser, mount }).db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('approve creates OrganizationUser with the role set at invite time', async () => {
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

    const targetFetch = createTestApp({ mockUser: invitee, mount }).fetch;
    const response = await targetFetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'approved' }));
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(200);
    expect(data.status).toBe(InquiryStatus.approved);

    const membership = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: invitee.id } },
    });
    expect(membership).toBeTruthy();
    expect(membership?.role).toBe('member');
  });

  it('deny does not create OrganizationUser', async () => {
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

    const targetFetch = createTestApp({ mockUser: invitee, mount }).fetch;
    await targetFetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'denied' }));

    const membership = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: invitee.id } },
    });
    expect(membership).toBeNull();
  });

  it('invitee cannot override role via resolution', async () => {
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

    const targetFetch = createTestApp({ mockUser: invitee, mount }).fetch;
    // Attempt to escalate to 'admin' via resolution payload
    await targetFetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'approved', role: 'admin' }));

    const membership = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: invitee.id } },
    });
    expect(membership?.role).toBe('member');
  });
});
