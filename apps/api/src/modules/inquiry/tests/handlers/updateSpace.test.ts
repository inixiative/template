import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, Space, SpaceUser } from '@template/db';
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
import { post } from '#tests/utils/request';

const mount = [(app: any) => app.route('/api/v1/space', spaceRouter)];

describe('handler: updateSpace — validate', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;
  let space: Space;
  let spaceUser: SpaceUser;
  let freshSpace: Space;

  beforeAll(async () => {
    const { entity: owner } = await createUser();
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou, context: ouCtx } = await createOrganizationUser(
      { role: 'owner' },
      { user: owner, organization: org },
    );
    const { entity: s } = await createSpace({}, { organization: org });
    space = s;
    const { entity: su } = await createSpaceUser({ role: 'owner' }, { ...ouCtx, space });
    spaceUser = su;
    const { entity: fs } = await createSpace({}, { organization: org });
    freshSpace = fs;
    const { entity: fsu } = await createSpaceUser({ role: 'owner' }, { ...ouCtx, space: freshSpace });

    const harness = createTestApp({
      mockUser: owner,
      mockOrganizationUsers: [ou],
      mockSpaceUsers: [spaceUser, fsu],
      mount,
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('rejects if another space in the org already has that slug', async () => {
    await createSpace({ slug: 'taken-slug' }, { organization: org });

    const response = await fetch(
      post(`/api/v1/space/${space.id}/inquiries`, {
        type: InquiryType.updateSpace,
        targetModel: InquiryResourceModel.admin,
        content: { slug: 'taken-slug' },
      }),
    );

    expect(response.status).toBe(409);
  });

  it('rejects if an open updateSpace inquiry for that slug already exists', async () => {
    await createInquiry({
      type: InquiryType.updateSpace,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Space,
      sourceSpaceId: space.id,
      targetModel: InquiryResourceModel.admin,
      content: { slug: 'pending-update-slug' },
    });

    const response = await fetch(
      post(`/api/v1/space/${space.id}/inquiries`, {
        type: InquiryType.updateSpace,
        targetModel: InquiryResourceModel.admin,
        content: { slug: 'pending-update-slug' },
      }),
    );

    expect(response.status).toBe(409);
  });

  it('allows creating an updateSpace inquiry with a unique slug', async () => {
    // Use a fresh space so no prior open updateSpace inquiry blocks the unique check
    const response = await fetch(
      post(`/api/v1/space/${freshSpace.id}/inquiries`, {
        type: InquiryType.updateSpace,
        targetModel: InquiryResourceModel.admin,
        content: { slug: 'totally-new-slug' },
      }),
    );

    expect(response.status).toBe(201);
  });
});
