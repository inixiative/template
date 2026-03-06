import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, Space } from '@template/db';
import { PlatformRole } from '@template/db/generated/client/enums';
import { InquiryResourceModel, InquiryStatus, InquiryType } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createInquiry,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createUser,
} from '@template/db/test';
import { inquiryRouter } from '#/modules/inquiry';
import { createTestApp } from '#tests/createTestApp';
import { post } from '#tests/utils/request';

const mount = [(app: any) => app.route('/api/v1/inquiry', inquiryRouter)];

describe('handler: updateSpace — approve', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;
  let space: Space;
  let adminFetch: ReturnType<typeof createTestApp>['fetch'];

  beforeAll(async () => {
    const { entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin });
    const { entity: o } = await createOrganization();
    org = o;
    await createOrganizationUser({ role: 'owner' }, { user: superadmin, organization: org });
    const { entity: s } = await createSpace({ slug: 'original-slug' }, { organization: org });
    space = s;

    const harness = createTestApp({ mockUser: superadmin, mount });
    adminFetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('approve updates the space with content fields', async () => {
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.updateSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Space,
      sourceSpaceId: space.id,
      targetModel: InquiryResourceModel.admin,
      content: { slug: 'updated-slug' },
    });

    const response = await adminFetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'approved' }));
    expect(response.status).toBe(200);

    const updated = await db.space.findUniqueOrThrow({ where: { id: space.id } });
    expect(updated.slug).toBe('updated-slug');
  });

  it('deny does not update the space', async () => {
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.updateSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Space,
      sourceSpaceId: space.id,
      targetModel: InquiryResourceModel.admin,
      content: { slug: 'denied-slug' },
    });

    await adminFetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'denied' }));

    const unchanged = await db.space.findUniqueOrThrow({ where: { id: space.id } });
    expect(unchanged.slug).toBe('updated-slug');
  });
});
