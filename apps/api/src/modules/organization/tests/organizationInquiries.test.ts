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
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

type InquiryList = { data: Inquiry[]; pagination: unknown };

const mount = [(app: any) => app.route('/api/v1/organization', organizationRouter)];

describe('GET /api/v1/organization/:id/inquiries/sent', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let admin: User;
  let org: Organization;
  let adminOrgUser: OrganizationUser;
  let otherOrg: Organization;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    admin = u;
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou } = await createOrganizationUser({ role: 'owner' }, { user: admin, organization: org });
    adminOrgUser = ou;
    const { entity: other } = await createOrganization();
    otherOrg = other;

    const harness = createTestApp({ mockUser: admin, mockOrganizationUsers: [adminOrgUser], mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it("returns only this org's sent inquiries", async () => {
    const { entity: target } = await createUser();

    const { entity: mine } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: target.id,
      content: { organizationId: org.id, role: 'member' },
    });

    await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: otherOrg.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: target.id,
      content: { organizationId: otherOrg.id, role: 'member' },
    });

    const response = await fetch(get(`/api/v1/organization/${org.id}/inquiries/sent`));
    const { data } = await json<InquiryList>(response);

    expect(response.status).toBe(200);
    expect(data.some((i) => i.id === mine.id)).toBe(true);
    expect(data.every((i) => i.sourceOrganizationId === org.id)).toBe(true);
  });

  it('returns 403 for non-owner', async () => {
    const { entity: member } = await createUser();
    const { entity: memberOu } = await createOrganizationUser({ role: 'member' }, { user: member, organization: org });

    const memberFetch = createTestApp({ mockUser: member, mockOrganizationUsers: [memberOu], mount }).fetch;
    const response = await memberFetch(get(`/api/v1/organization/${org.id}/inquiries/sent`));
    expect(response.status).toBe(403);
  });
});

describe('GET /api/v1/organization/:id/inquiries/received', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let member: User;
  let org: Organization;
  let memberOu: OrganizationUser;
  let otherOrg: Organization;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    member = u;
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou } = await createOrganizationUser({ role: 'member' }, { user: member, organization: org });
    memberOu = ou;
    const { entity: other } = await createOrganization();
    otherOrg = other;

    const harness = createTestApp({ mockUser: member, mockOrganizationUsers: [memberOu], mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('returns only non-draft inquiries received by this org', async () => {
    const { entity: sender } = await createUser();

    const { entity: mine } = await createInquiry({
      type: InquiryType.transferSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.User,
      sourceUserId: sender.id,
      targetModel: InquiryResourceModel.Organization,
      targetOrganizationId: org.id,
      content: { spaceId: 'space-1', targetOrganizationId: org.id },
    });

    await createInquiry({
      type: InquiryType.transferSpace,
      status: InquiryStatus.draft,
      sourceModel: InquiryResourceModel.User,
      sourceUserId: sender.id,
      targetModel: InquiryResourceModel.Organization,
      targetOrganizationId: org.id,
      content: { spaceId: 'space-2', targetOrganizationId: org.id },
    });

    await createInquiry({
      type: InquiryType.transferSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.User,
      sourceUserId: sender.id,
      targetModel: InquiryResourceModel.Organization,
      targetOrganizationId: otherOrg.id,
      content: { spaceId: 'space-3', targetOrganizationId: otherOrg.id },
    });

    const response = await fetch(get(`/api/v1/organization/${org.id}/inquiries/received`));
    const { data } = await json<InquiryList>(response);

    expect(response.status).toBe(200);
    expect(data.some((i) => i.id === mine.id)).toBe(true);
    expect(data.every((i) => i.targetOrganizationId === org.id)).toBe(true);
    expect(data.every((i) => i.status !== InquiryStatus.draft)).toBe(true);
  });
});
