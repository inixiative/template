import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
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
import { createTestApp } from '#tests/createTestApp';
import { json, patch } from '#tests/utils/request';

const mount = [(app: any) => app.route('/api/v1/inquiry', inquiryRouter)];

describe('PATCH /api/v1/inquiry/:id', () => {
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
    const { entity: ou } = await createOrganizationUser({ role: 'owner' }, { user: admin, organization: org });
    adminOrgUser = ou;

    const harness = createTestApp({ mockUser: admin, mockOrganizationUsers: [adminOrgUser], mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('updates a draft inquiry content', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.draft,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'owner' },
    });

    const response = await fetch(
      patch(`/api/v1/inquiry/${inquiry.id}`, { content: { organizationId: org.id, role: 'member' } }),
    );
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(200);
    expect((data.content as any).role).toBe('member');
  });

  it('allows updating a sent inquiry', async () => {
    const { entity: invitee } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'owner' },
    });

    const response = await fetch(
      patch(`/api/v1/inquiry/${inquiry.id}`, { content: { organizationId: org.id, role: 'member' } }),
    );
    expect(response.status).toBe(200);
  });

  it('rejects role elevation via content update', async () => {
    const { entity: adminUser } = await createUser();
    const { entity: adminOu } = await createOrganizationUser({ role: 'admin' }, { user: adminUser, organization: org });
    const adminFetch = createTestApp({ mockUser: adminUser, mockOrganizationUsers: [adminOu], mount }).fetch;

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

    const response = await adminFetch(
      patch(`/api/v1/inquiry/${inquiry.id}`, { content: { organizationId: org.id, role: 'admin' } }),
    );
    expect(response.status).toBe(403);
  });

  it('rejects updating a resolved inquiry', async () => {
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

    const response = await fetch(patch(`/api/v1/inquiry/${inquiry.id}`, { content: {} }));
    expect(response.status).toBe(400);
  });
});
