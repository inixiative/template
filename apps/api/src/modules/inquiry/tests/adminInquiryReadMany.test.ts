import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { User } from '@template/db';
import { InquiryResourceModel, InquiryStatus, InquiryType, PlatformRole } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createInquiry, createOrganization, createUser } from '@template/db/test';
import { adminInquiryRouter } from '#/modules/inquiry';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

type ReadManyResponse = {
  data: Array<{ id: string; expiresAt: string | null }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

describe('GET /api/admin/inquiry', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let superadmin: User;

  beforeAll(async () => {
    const { entity } = await createUser({ platformRole: PlatformRole.superadmin });
    superadmin = entity;

    const harness = createTestApp({
      mockUser: superadmin,
      mount: [(app) => app.route('/api/admin/inquiry', adminInquiryRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('applies expiresAt gte filters while including never-expiring inquiries', async () => {
    const { entity: sourceOrganization } = await createOrganization();
    const { entity: targetUser } = await createUser();

    const now = new Date();
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    const past = new Date(now.getTime() - 60 * 60 * 1000);

    const { entity: futureInquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: sourceOrganization.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: targetUser.id,
      content: { organizationId: sourceOrganization.id, role: 'member' },
      expiresAt: future,
    });

    const { entity: pastInquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: sourceOrganization.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: targetUser.id,
      content: { organizationId: sourceOrganization.id, role: 'member' },
      expiresAt: past,
    });

    const { entity: noExpiryInquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: sourceOrganization.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: targetUser.id,
      content: { organizationId: sourceOrganization.id, role: 'member' },
      expiresAt: null,
    });

    const response = await fetch(
      get(`/api/admin/inquiry?searchFields[expiresAt][gte]=${encodeURIComponent(now.toISOString())}`),
    );
    const { data } = await json<ReadManyResponse['data']>(response);

    expect(response.status).toBe(200);
    expect(data.map((inq) => inq.id)).toContain(futureInquiry.id);
    expect(data.map((inq) => inq.id)).not.toContain(pastInquiry.id);
    expect(data.map((inq) => inq.id)).toContain(noExpiryInquiry.id);
  });
});
