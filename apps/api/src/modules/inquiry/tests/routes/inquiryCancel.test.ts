import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, OrganizationUser, User } from '@template/db';
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
import { del } from '#tests/utils/request';

const mount: MountFn[] = [(app) => app.route('/api/v1/inquiry', inquiryRouter)];

describe('DELETE /api/v1/inquiry/:id/cancel', () => {
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

  it('cancels a sent inquiry', async () => {
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

    const response = await fetch(del(`/api/v1/inquiry/${inquiry.id}/cancel`));
    expect(response.status).toBe(204);
  });

  it('clears expiresAt when canceling an expiring inquiry', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
      expiresAt: new Date('2099-01-01'),
    });

    const response = await fetch(del(`/api/v1/inquiry/${inquiry.id}/cancel`));
    expect(response.status).toBe(204);

    const updated = await db.inquiry.findUnique({ where: { id: inquiry.id } });
    expect(updated?.expiresAt).toBeNull();
  });

  it('rejects canceling an already resolved inquiry', async () => {
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

    const response = await fetch(del(`/api/v1/inquiry/${inquiry.id}/cancel`));
    expect(response.status).toBe(400);
  });
});
