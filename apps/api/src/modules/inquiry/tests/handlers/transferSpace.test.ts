import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, Space, SpaceUser } from '@template/db';
import { PlatformRole, InquiryResourceModel, InquiryStatus, InquiryType } from '@template/db/generated/client/enums';
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
import { inquiryRouter } from '#/modules/inquiry';
import { createTestApp } from '#tests/createTestApp';
import { post } from '#tests/utils/request';

describe('handler: transferSpace', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;
  let space: Space;
  let targetOrg1: Organization;
  let targetOrg2: Organization;
  let ownerFetch: ReturnType<typeof createTestApp>['fetch'];
  let adminFetch: ReturnType<typeof createTestApp>['fetch'];

  beforeAll(async () => {
    const { entity: owner } = await createUser();
    const { entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin });
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou, context: ouCtx } = await createOrganizationUser({ role: 'owner' }, { user: owner, organization: org });
    const { entity: s } = await createSpace({}, { organization: org });
    space = s;
    const { entity: su } = await createSpaceUser({ role: 'owner' }, { ...ouCtx, space });
    const { entity: to1 } = await createOrganization();
    targetOrg1 = to1;
    const { entity: to2 } = await createOrganization();
    targetOrg2 = to2;

    const ownerHarness = createTestApp({ mockUser: owner, mockOrganizationUsers: [ou], mockSpaceUsers: [su], mount: [(app: any) => app.route('/api/v1/space', spaceRouter)] });
    ownerFetch = ownerHarness.fetch;
    db = ownerHarness.db;

    adminFetch = createTestApp({ mockUser: superadmin, mount: [(app: any) => app.route('/api/v1/inquiry', inquiryRouter)] }).fetch;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('rejects a second open transfer for the same space, even to a different target org', async () => {
    await createInquiry({
      type: InquiryType.transferSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Space,
      sourceSpaceId: space.id,
      targetModel: InquiryResourceModel.Organization,
      targetOrganizationId: targetOrg1.id,
      content: {},
    });

    const response = await ownerFetch(post(`/api/v1/space/${space.id}/inquiries`, {
      type: InquiryType.transferSpace,
      targetModel: InquiryResourceModel.Organization,
      targetOrganizationId: targetOrg2.id,
      content: {},
    }));

    expect(response.status).toBe(409);
  });

  it('approve transfers the space to the target org', async () => {
    const { entity: freshSpace } = await createSpace({}, { organization: org });

    const { entity: inquiry } = await createInquiry({
      type: InquiryType.transferSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Space,
      sourceSpaceId: freshSpace.id,
      targetModel: InquiryResourceModel.Organization,
      targetOrganizationId: targetOrg1.id,
      content: {},
    });

    const response = await adminFetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'approved' }));
    expect(response.status).toBe(200);

    const transferred = await db.space.findUniqueOrThrow({ where: { id: freshSpace.id } });
    expect(transferred.organizationId).toBe(targetOrg1.id);
  });

  it('deny does not change the space org', async () => {
    const { entity: freshSpace } = await createSpace({}, { organization: org });

    const { entity: inquiry } = await createInquiry({
      type: InquiryType.transferSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Space,
      sourceSpaceId: freshSpace.id,
      targetModel: InquiryResourceModel.Organization,
      targetOrganizationId: targetOrg1.id,
      content: {},
    });

    await adminFetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'denied' }));

    const unchanged = await db.space.findUniqueOrThrow({ where: { id: freshSpace.id } });
    expect(unchanged.organizationId).toBe(org.id);
  });
});
