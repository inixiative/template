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
import { get, json, post } from '#tests/utils/request';

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

describe('POST /api/v1/organization/:id/inquiries — inviteOrganizationUser (low roles)', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;

  beforeAll(async () => {
    const { entity: adminUser } = await createUser();
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: adminOu } = await createOrganizationUser({ role: 'admin' }, { user: adminUser, organization: org });

    const harness = createTestApp({ mockUser: adminUser, mockOrganizationUsers: [adminOu], mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('admin can invite with member role (draft)', async () => {
    const { entity: invitee } = await createUser();

    const response = await fetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.inviteOrganizationUser,
        targetModel: InquiryResourceModel.User,
        content: { organizationId: org.id, role: 'member' },
        targetUserId: invitee.id,
      }),
    );
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(201);
    expect(data.type).toBe(InquiryType.inviteOrganizationUser);
    expect(data.status).toBe(InquiryStatus.draft);
    expect(data.sourceModel).toBe(InquiryResourceModel.Organization);
    expect(data.sourceOrganizationId).toBe(org.id);
    expect(data.targetModel).toBe(InquiryResourceModel.User);
    expect(data.targetUserId).toBe(invitee.id);
  });

  it('admin can send invite immediately (status=sent)', async () => {
    const { entity: invitee } = await createUser();

    const response = await fetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.inviteOrganizationUser,
        targetModel: InquiryResourceModel.User,
        status: InquiryStatus.sent,
        content: { organizationId: org.id, role: 'member' },
        targetUserId: invitee.id,
      }),
    );
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(201);
    expect(data.status).toBe(InquiryStatus.sent);
    expect(data.sentAt).toBeTruthy();
  });

  it('rejects duplicate open invite to same user', async () => {
    const { entity: invitee } = await createUser();
    await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { organizationId: org.id, role: 'member' },
    });

    const response = await fetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.inviteOrganizationUser,
        targetModel: InquiryResourceModel.User,
        status: InquiryStatus.sent,
        content: { organizationId: org.id, role: 'member' },
        targetUserId: invitee.id,
      }),
    );

    expect(response.status).toBe(409);
  });

  it('admin cannot invite with high role (owner)', async () => {
    const { entity: invitee } = await createUser();

    const response = await fetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.inviteOrganizationUser,
        targetModel: InquiryResourceModel.User,
        content: { organizationId: org.id, role: 'owner' },
        targetUserId: invitee.id,
      }),
    );

    expect(response.status).toBe(403);
  });

  it('member cannot invite at all', async () => {
    const { entity: memberUser } = await createUser();
    const { entity: memberOu } = await createOrganizationUser(
      { role: 'member' },
      { user: memberUser, organization: org },
    );
    const { entity: invitee } = await createUser();

    const memberFetch = createTestApp({ mockUser: memberUser, mockOrganizationUsers: [memberOu], mount }).fetch;
    const response = await memberFetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.inviteOrganizationUser,
        targetModel: InquiryResourceModel.User,
        content: { organizationId: org.id, role: 'member' },
        targetUserId: invitee.id,
      }),
    );

    expect(response.status).toBe(403);
  });
});

describe('POST /api/v1/organization/:id/inquiries — inviteOrganizationUser (high roles)', () => {
  let ownerFetch: ReturnType<typeof createTestApp>['fetch'];
  let adminFetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;

  beforeAll(async () => {
    const { entity: ownerUser } = await createUser();
    const { entity: adminUser } = await createUser();
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ownerOu } = await createOrganizationUser({ role: 'owner' }, { user: ownerUser, organization: org });
    const { entity: adminOu } = await createOrganizationUser({ role: 'admin' }, { user: adminUser, organization: org });

    const ownerHarness = createTestApp({ mockUser: ownerUser, mockOrganizationUsers: [ownerOu], mount });
    ownerFetch = ownerHarness.fetch;
    db = ownerHarness.db;
    adminFetch = createTestApp({ mockUser: adminUser, mockOrganizationUsers: [adminOu], mount }).fetch;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('owner can invite with admin role', async () => {
    const { entity: invitee } = await createUser();

    const response = await ownerFetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.inviteOrganizationUser,
        targetModel: InquiryResourceModel.User,
        content: { organizationId: org.id, role: 'admin' },
        targetUserId: invitee.id,
      }),
    );

    expect(response.status).toBe(201);
    const { data } = await json<Inquiry>(response);
    expect(data.type).toBe(InquiryType.inviteOrganizationUser);
  });

  it('owner can invite with owner role', async () => {
    const { entity: invitee } = await createUser();

    const response = await ownerFetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.inviteOrganizationUser,
        targetModel: InquiryResourceModel.User,
        content: { organizationId: org.id, role: 'owner' },
        targetUserId: invitee.id,
      }),
    );

    expect(response.status).toBe(201);
  });

  it('admin cannot invite with owner role', async () => {
    const { entity: invitee } = await createUser();

    const response = await adminFetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.inviteOrganizationUser,
        targetModel: InquiryResourceModel.User,
        content: { organizationId: org.id, role: 'owner' },
        targetUserId: invitee.id,
      }),
    );

    expect(response.status).toBe(403);
  });

  it('admin cannot invite with admin role', async () => {
    const { entity: invitee } = await createUser();

    const response = await adminFetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.inviteOrganizationUser,
        targetModel: InquiryResourceModel.User,
        content: { organizationId: org.id, role: 'admin' },
        targetUserId: invitee.id,
      }),
    );

    expect(response.status).toBe(403);
  });
});

describe('POST /api/v1/organization/:id/inquiries — createSpace', () => {
  let ownerFetch: ReturnType<typeof createTestApp>['fetch'];
  let adminFetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;

  beforeAll(async () => {
    const { entity: ownerUser } = await createUser();
    const { entity: adminUser } = await createUser();
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ownerOu } = await createOrganizationUser({ role: 'owner' }, { user: ownerUser, organization: org });
    const { entity: adminOu } = await createOrganizationUser({ role: 'admin' }, { user: adminUser, organization: org });

    const ownerHarness = createTestApp({ mockUser: ownerUser, mockOrganizationUsers: [ownerOu], mount });
    ownerFetch = ownerHarness.fetch;
    db = ownerHarness.db;
    adminFetch = createTestApp({ mockUser: adminUser, mockOrganizationUsers: [adminOu], mount }).fetch;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('owner can create a createSpace inquiry targeting admin', async () => {
    const response = await ownerFetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.createSpace,
        targetModel: InquiryResourceModel.admin,
        content: { name: 'My New Space', slug: 'my-new-space' },
      }),
    );
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(201);
    expect(data.type).toBe(InquiryType.createSpace);
    expect(data.sourceModel).toBe(InquiryResourceModel.Organization);
    expect(data.sourceOrganizationId).toBe(org.id);
    expect(data.targetModel).toBe(InquiryResourceModel.admin);
  });

  it('admin cannot create a createSpace inquiry', async () => {
    const response = await adminFetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.createSpace,
        targetModel: InquiryResourceModel.admin,
        content: { name: 'My New Space', slug: 'my-new-space-2' },
      }),
    );

    expect(response.status).toBe(403);
  });
});

describe('GET /api/v1/organization/:id/inquiries/received', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let admin: User;
  let org: Organization;
  let adminOu: OrganizationUser;
  let otherOrg: Organization;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    admin = u;
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou } = await createOrganizationUser({ role: 'admin' }, { user: admin, organization: org });
    adminOu = ou;
    const { entity: other } = await createOrganization();
    otherOrg = other;

    const harness = createTestApp({ mockUser: admin, mockOrganizationUsers: [adminOu], mount });
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
