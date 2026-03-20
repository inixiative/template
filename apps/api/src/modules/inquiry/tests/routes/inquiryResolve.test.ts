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
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

const mount: MountFn[] = [(app) => app.route('/api/v1/inquiry', inquiryRouter)];

describe('POST /api/v1/inquiry/:id/resolve', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;
  let targetUser: User;

  beforeAll(async () => {
    const { entity: sourceUser } = await createUser();
    const { entity: o } = await createOrganization();
    org = o;
    await createOrganizationUser({ role: 'admin' }, { user: sourceUser, organization: org });

    const { entity: tu } = await createUser();
    targetUser = tu;

    db = createTestApp({ mockUser: targetUser, mount }).db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('sets status to approved', async () => {
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
  });

  it('returns source relations but not target relations in response', async () => {
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
    const { data } = await json<Record<string, unknown>>(response);

    expect(response.status).toBe(200);
    expect(data.sourceOrganization).toBeDefined();
    expect(data.targetUser).toBeUndefined();
  });

  it('sets status to denied', async () => {
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
    const response = await targetFetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'denied' }));
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(200);
    expect(data.status).toBe(InquiryStatus.denied);
  });

  it('rejects resolving an expired inquiry with approved', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
      expiresAt: new Date('2020-01-01'),
    });

    const targetFetch = createTestApp({ mockUser: invitee, mount }).fetch;
    const response = await targetFetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'approved' }));
    expect(response.status).toBe(410);
  });

  it('rejects resolving an expired inquiry with denied', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
      expiresAt: new Date('2020-01-01'),
    });

    const targetFetch = createTestApp({ mockUser: invitee, mount }).fetch;
    const response = await targetFetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'denied' }));
    expect(response.status).toBe(410);
  });

  it('rejects resolving an already resolved inquiry', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.approved,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
    });

    const targetFetch = createTestApp({ mockUser: invitee, mount }).fetch;
    const response = await targetFetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'approved' }));
    expect(response.status).toBe(400);
  });
});
