import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Inquiry, Organization, OrganizationUser, Space, SpaceUser, User } from '@template/db';
import { InquiryResourceModel, InquiryStatus, InquiryType } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createInquiry,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { get, json, post } from '#tests/utils/request';

type InquiryList = { data: Inquiry[]; pagination: unknown };

const mount = [(app: any) => app.route('/api/v1/space', spaceRouter)];

describe('GET /api/v1/space/:id/inquiries/sent', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let admin: User;
  let org: Organization;
  let adminOu: OrganizationUser;
  let space: Space;
  let adminSu: SpaceUser;
  let otherSpace: Space;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    admin = u;
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou, context: ouCtx } = await createOrganizationUser({ role: 'owner' }, { user: admin, organization: org });
    adminOu = ou;
    const { entity: s } = await createSpace({}, { organization: org });
    space = s;
    const { entity: su } = await createSpaceUser({ role: 'owner' }, { ...ouCtx, space });
    adminSu = su;
    const { entity: other } = await createSpace({}, { organization: org });
    otherSpace = other;

    const harness = createTestApp({ mockUser: admin, mockOrganizationUsers: [adminOu], mockSpaceUsers: [adminSu], mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it("returns only this space's sent inquiries", async () => {
    const { entity: mine } = await createInquiry({
      type: InquiryType.updateSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Space,
      sourceSpaceId: space.id,
      targetModel: InquiryResourceModel.admin,
      content: { spaceId: space.id },
    });

    await createInquiry({
      type: InquiryType.updateSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Space,
      sourceSpaceId: otherSpace.id,
      targetModel: InquiryResourceModel.admin,
      content: { spaceId: otherSpace.id },
    });

    const response = await fetch(get(`/api/v1/space/${space.id}/inquiries/sent`));
    const { data } = await json<InquiryList>(response);

    expect(response.status).toBe(200);
    expect(data.some((i) => i.id === mine.id)).toBe(true);
    expect(data.every((i) => i.sourceSpaceId === space.id)).toBe(true);
  });

  it('returns 403 for non-owner', async () => {
    const { entity: viewer } = await createUser();
    const { entity: viewerOu, context: viewerOuCtx } = await createOrganizationUser({ role: 'member' }, { user: viewer, organization: org });
    const { entity: viewerSu } = await createSpaceUser({ role: 'viewer' }, { ...viewerOuCtx, space });

    const viewerFetch = createTestApp({ mockUser: viewer, mockOrganizationUsers: [viewerOu], mockSpaceUsers: [viewerSu], mount }).fetch;
    const response = await viewerFetch(get(`/api/v1/space/${space.id}/inquiries/sent`));
    expect(response.status).toBe(403);
  });
});

describe('POST /api/v1/space/:id/inquiries', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let admin: User;
  let org: Organization;
  let adminOu: OrganizationUser;
  let space: Space;
  let adminSu: SpaceUser;
  let targetOrg: Organization;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    admin = u;
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou, context: ouCtx } = await createOrganizationUser({ role: 'admin' }, { user: admin, organization: org });
    adminOu = ou;
    const { entity: s } = await createSpace({}, { organization: org });
    space = s;
    const { entity: su } = await createSpaceUser({ role: 'admin' }, { ...ouCtx, space });
    adminSu = su;
    const { entity: to } = await createOrganization();
    targetOrg = to;

    const harness = createTestApp({ mockUser: admin, mockOrganizationUsers: [adminOu], mockSpaceUsers: [adminSu], mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('creates an updateSpace inquiry targeting admin', async () => {
    const response = await fetch(post(`/api/v1/space/${space.id}/inquiries`, {
      type: InquiryType.updateSpace,
      targetModel: InquiryResourceModel.admin,
      content: { spaceId: space.id },
    }));
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(201);
    expect(data.type).toBe(InquiryType.updateSpace);
    expect(data.sourceModel).toBe(InquiryResourceModel.Space);
    expect(data.sourceSpaceId).toBe(space.id);
    expect(data.targetModel).toBe(InquiryResourceModel.admin);
  });

  it('creates a transferSpace inquiry targeting another organization', async () => {
    const response = await fetch(post(`/api/v1/space/${space.id}/inquiries`, {
      type: InquiryType.transferSpace,
      targetModel: InquiryResourceModel.Organization,
      content: { spaceId: space.id, targetOrganizationId: targetOrg.id },
    }));
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(201);
    expect(data.type).toBe(InquiryType.transferSpace);
    expect(data.sourceModel).toBe(InquiryResourceModel.Space);
    expect(data.sourceSpaceId).toBe(space.id);
    expect(data.targetModel).toBe(InquiryResourceModel.Organization);
    expect(data.targetOrganizationId).toBe(targetOrg.id);
  });
});

describe('GET /api/v1/space/:id/inquiries/received', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let member: User;
  let org: Organization;
  let memberOu: OrganizationUser;
  let space: Space;
  let memberSu: SpaceUser;
  let otherSpace: Space;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    member = u;
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou, context: ouCtx } = await createOrganizationUser({ role: 'member' }, { user: member, organization: org });
    memberOu = ou;
    const { entity: s } = await createSpace({}, { organization: org });
    space = s;
    const { entity: su } = await createSpaceUser({ role: 'member' }, { ...ouCtx, space });
    memberSu = su;
    const { entity: other } = await createSpace({}, { organization: org });
    otherSpace = other;

    const harness = createTestApp({ mockUser: member, mockOrganizationUsers: [memberOu], mockSpaceUsers: [memberSu], mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('returns only non-draft inquiries received by this space', async () => {
    const { entity: sender } = await createUser();

    const { entity: mine } = await createInquiry({
      type: InquiryType.transferSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.User,
      sourceUserId: sender.id,
      targetModel: InquiryResourceModel.Space,
      targetSpaceId: space.id,
      content: { spaceId: space.id },
    });

    await createInquiry({
      type: InquiryType.transferSpace,
      status: InquiryStatus.draft,
      sourceModel: InquiryResourceModel.User,
      sourceUserId: sender.id,
      targetModel: InquiryResourceModel.Space,
      targetSpaceId: space.id,
      content: { spaceId: space.id },
    });

    await createInquiry({
      type: InquiryType.transferSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.User,
      sourceUserId: sender.id,
      targetModel: InquiryResourceModel.Space,
      targetSpaceId: otherSpace.id,
      content: { spaceId: otherSpace.id },
    });

    const response = await fetch(get(`/api/v1/space/${space.id}/inquiries/received`));
    const { data } = await json<InquiryList>(response);

    expect(response.status).toBe(200);
    expect(data.some((i) => i.id === mine.id)).toBe(true);
    expect(data.every((i) => i.targetSpaceId === space.id)).toBe(true);
    expect(data.every((i) => i.status !== InquiryStatus.draft)).toBe(true);
  });
});
