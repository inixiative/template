import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Inquiry, Organization } from '@template/db';
import { InquiryResourceModel, InquiryStatus, InquiryType } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createInquiry,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createUser,
} from '@template/db/test';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

const mount = [(app: any) => app.route('/api/v1/organization', organizationRouter)];

describe('handler: createSpace — validate', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;

  beforeAll(async () => {
    const { entity: owner } = await createUser();
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou } = await createOrganizationUser({ role: 'owner' }, { user: owner, organization: org });

    const harness = createTestApp({ mockUser: owner, mockOrganizationUsers: [ou], mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('rejects if a space with that slug already exists', async () => {
    await createSpace({ slug: 'existing-slug' }, { organization: org });

    const response = await fetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.createSpace,
        targetModel: InquiryResourceModel.admin,
        content: { name: 'My Space', slug: 'existing-slug' },
      }),
    );

    expect(response.status).toBe(409);
  });

  it('rejects if an open createSpace inquiry for that slug already exists', async () => {
    await createInquiry({
      type: InquiryType.createSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
      targetModel: InquiryResourceModel.admin,
      content: { name: 'My Space', slug: 'pending-slug' },
    });

    const response = await fetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.createSpace,
        targetModel: InquiryResourceModel.admin,
        content: { name: 'My Space', slug: 'pending-slug' },
      }),
    );

    expect(response.status).toBe(409);
  });

  it('allows creating a createSpace inquiry with a unique slug', async () => {
    const response = await fetch(
      post(`/api/v1/organization/${org.id}/inquiries`, {
        type: InquiryType.createSpace,
        targetModel: InquiryResourceModel.admin,
        content: { name: 'My Space', slug: 'brand-new-slug' },
      }),
    );
    const { data } = await json<Inquiry>(response);

    expect(response.status).toBe(201);
    expect(data.type).toBe(InquiryType.createSpace);
  });
});
