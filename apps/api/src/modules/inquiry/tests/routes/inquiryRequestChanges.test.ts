import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Inquiry, Organization, User } from '@template/db';
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
import { json, post } from '#tests/utils/request';

const mount = [(app: any) => app.route('/api/v1/inquiry', inquiryRouter)];

describe('POST /api/v1/inquiry/:id/resolve (changesRequested)', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;
  let targetUser: User;

  beforeAll(async () => {
    const { entity: sourceUser } = await createUser();
    const { entity: o } = await createOrganization();
    org = o;
    await createOrganizationUser({ role: 'admin' }, { user: sourceUser, organization: org });

    const { entity: tu } = await createUser();
    targetUser = tu;

    const harness = createTestApp({ mockUser: targetUser, mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('moves inquiry to changesRequested', async () => {
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: targetUser.id,
      content: { organizationId: org.id, role: 'member' },
    });

    const response = await fetch(post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: InquiryStatus.changesRequested, explanation: 'Please change the role' }));
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(200);
    expect(data.status).toBe(InquiryStatus.changesRequested);
  });
});
