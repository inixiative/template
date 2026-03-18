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
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

const mount: MountFn[] = [(app) => app.route('/api/v1/inquiry', inquiryRouter)];

describe('GET /api/v1/inquiry/:id', () => {
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

  it('source can read own inquiry', async () => {
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

    const response = await fetch(get(`/api/v1/inquiry/${inquiry.id}`));
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(200);
    expect(data.id).toBe(inquiry.id);
  });

  it('target can read inquiry sent to them', async () => {
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
    const response = await targetFetch(get(`/api/v1/inquiry/${inquiry.id}`));
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(200);
    expect(data.id).toBe(inquiry.id);
  });

  it('unrelated user cannot read inquiry', async () => {
    const { entity: invitee } = await createUser();
    const { entity: stranger } = await createUser();
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
    });

    const strangerFetch = createTestApp({ mockUser: stranger, mount }).fetch;
    const response = await strangerFetch(get(`/api/v1/inquiry/${inquiry.id}`));
    expect(response.status).toBe(403);
  });

  it('returns 404 for unknown id', async () => {
    const response = await fetch(get('/api/v1/inquiry/00000000-0000-0000-0000-000000000000'));
    expect(response.status).toBe(404);
  });
});
