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
import { inquiryRouter } from '#/modules/inquiry';
import { createTestApp } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

const mount = [(app: any) => app.route('/api/v1/inquiry', inquiryRouter)];

describe('POST /api/v1/inquiry', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let admin: User;
  let org: Organization;
  let adminOrgUser: OrganizationUser;
  let space: Space;
  let adminSpaceUser: SpaceUser;
  let targetOrg: Organization;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    admin = u;
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou, context: ouCtx } = await createOrganizationUser({ role: 'admin' }, { user: admin, organization: org });
    adminOrgUser = ou;
    const { entity: s } = await createSpace({}, { organization: org });
    space = s;
    const { entity: su } = await createSpaceUser({ role: 'admin' }, { ...ouCtx, space });
    adminSpaceUser = su;
    const { entity: to } = await createOrganization();
    targetOrg = to;

    const harness = createTestApp({ mockUser: admin, mockOrganizationUsers: [adminOrgUser], mockSpaceUsers: [adminSpaceUser], mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('creates a draft inviteOrganizationUser inquiry', async () => {
    const { entity: invitee } = await createUser();

    const response = await fetch(post('/api/v1/inquiry', {
      type: InquiryType.inviteOrganizationUser,
      content: { organizationId: org.id, role: 'member' },
      targetUserId: invitee.id,
    }));
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(201);
    expect(data.type).toBe(InquiryType.inviteOrganizationUser);
    expect(data.status).toBe(InquiryStatus.draft);
    expect(data.sourceModel).toBe(InquiryResourceModel.Organization);
    expect(data.sourceOrganizationId).toBe(org.id);
    expect(data.targetModel).toBe(InquiryResourceModel.User);
    expect(data.targetUserId).toBe(invitee.id);
  });

  it('creates and immediately sends when status=sent', async () => {
    const { entity: invitee } = await createUser();

    const response = await fetch(post('/api/v1/inquiry', {
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      content: { organizationId: org.id, role: 'member' },
      targetUserId: invitee.id,
    }));
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

    const response = await fetch(post('/api/v1/inquiry', {
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      content: { organizationId: org.id, role: 'member' },
      targetUserId: invitee.id,
    }));

    expect(response.status).toBe(409);
  });

  it('rejects non-admin creating invite', async () => {
    const { entity: member } = await createUser();
    const { entity: memberOu } = await createOrganizationUser({ role: 'member' }, { user: member, organization: org });
    const { entity: invitee } = await createUser();

    const memberFetch = createTestApp({ mockUser: member, mockOrganizationUsers: [memberOu], mount }).fetch;
    const response = await memberFetch(post('/api/v1/inquiry', {
      type: InquiryType.inviteOrganizationUser,
      content: { organizationId: org.id, role: 'member' },
      targetUserId: invitee.id,
    }));

    expect(response.status).toBe(403);
  });

  it('creates a createSpace inquiry targeting admin', async () => {
    const response = await fetch(post('/api/v1/inquiry', {
      type: InquiryType.createSpace,
      content: { organizationId: org.id, name: 'My New Space' },
    }));
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(201);
    expect(data.type).toBe(InquiryType.createSpace);
    expect(data.sourceModel).toBe(InquiryResourceModel.Organization);
    expect(data.sourceOrganizationId).toBe(org.id);
    expect(data.targetModel).toBe(InquiryResourceModel.admin);
    expect(data.targetUserId).toBeNull();
  });

  it('creates an updateSpace inquiry sourced from a space', async () => {
    const response = await fetch(post('/api/v1/inquiry', {
      type: InquiryType.updateSpace,
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
    const response = await fetch(post('/api/v1/inquiry', {
      type: InquiryType.transferSpace,
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
