import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization } from '@template/db';
import { InquiryResourceModel, InquiryStatus, InquiryType, PlatformRole } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createInquiry,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import { inquiryRouter } from '#/modules/inquiry';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { post } from '#tests/utils/request';

const mount: MountFn[] = [(app) => app.route('/api/v1/inquiry', inquiryRouter)];

describe('handler: createSpace — approve', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;
  let adminFetch: ReturnType<typeof createTestApp>['fetch'];

  beforeAll(async () => {
    const { entity: owner } = await createUser();
    const { entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin });
    const { entity: o } = await createOrganization();
    org = o;
    await createOrganizationUser({ role: 'owner' }, { user: owner, organization: org });

    const harness = createTestApp({ mockUser: superadmin, mount });
    adminFetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('approve creates the space under the source org', async () => {
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.createSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.admin,
      content: { name: 'Approved Space', slug: 'approved-space' },
    });

    const response = await adminFetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'approved' }));
    expect(response.status).toBe(200);

    const space = await db.space.findFirst({ where: { slug: 'approved-space', organizationId: org.id } });
    expect(space).toBeTruthy();
    expect(space?.name).toBe('Approved Space');
  });

  it('deny does not create a space', async () => {
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.createSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.admin,
      content: { name: 'Denied Space', slug: 'denied-space' },
    });

    await adminFetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'denied' }));

    const space = await db.space.findFirst({ where: { slug: 'denied-space' } });
    expect(space).toBeNull();
  });
});
