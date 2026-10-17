import { afterAll, describe, expect, it } from 'bun:test';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import { validator } from 'hono/validator';
import {
  type InquiryTargetBody,
  resolveInquiryTarget,
} from '#/modules/inquiry/services/resolveInquiryTarget';
import { createTestApp } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

const { fetch, db } = createTestApp({
  mount: [
    (app) =>
      app.post(
        '/resolve',
        validator('json', (value) => value as InquiryTargetBody),
        async (c) => c.json({ data: await resolveInquiryTarget(c) }),
      ),
  ],
});

const resolve = (body: InquiryTargetBody) => fetch(post('/resolve', body));

afterAll(async () => {
  await cleanupTouchedTables(db);
});

describe('resolveInquiryTarget', () => {
  it('resolves an organization user from organizationId and userId', async () => {
    const { entity: membership } = await createOrganizationUser();
    const response = await resolve({
      targetModel: InquiryResourceModel.OrganizationUser,
      targetOrganizationId: membership.organizationId,
      targetUserId: membership.userId,
    });
    expect(response.status).toBe(200);
    expect((await json(response)).data).toEqual({
      targetModel: 'OrganizationUser',
      targetOrganizationId: membership.organizationId,
      targetUserId: membership.userId,
      targetSpaceId: null,
      targetIntegrationId: null,
      targetTokenId: null,
    });
  });

  it('refuses an organization user who is not a member', async () => {
    const { entity: membership } = await createOrganizationUser();
    const { entity: stranger } = await createUser();
    const response = await resolve({
      targetModel: InquiryResourceModel.OrganizationUser,
      targetOrganizationId: membership.organizationId,
      targetUserId: stranger.id,
    });
    expect(response.status).toBe(404);
    expect(
      (
        await resolve({
          targetModel: InquiryResourceModel.OrganizationUser,
          targetUserId: stranger.id,
        })
      ).status,
    ).toBe(422);
  });

  it('resolves a space user from spaceId and userId, deriving the organization', async () => {
    const { entity: membership } = await createSpaceUser();
    const response = await resolve({
      targetModel: InquiryResourceModel.SpaceUser,
      targetSpaceId: membership.spaceId,
      targetUserId: membership.userId,
    });
    expect(response.status).toBe(200);
    expect((await json(response)).data).toEqual({
      targetModel: 'SpaceUser',
      targetOrganizationId: membership.organizationId,
      targetSpaceId: membership.spaceId,
      targetUserId: membership.userId,
      targetIntegrationId: null,
      targetTokenId: null,
    });
  });

  it('refuses a space user who is not a member of that space', async () => {
    const { entity: membership } = await createSpaceUser();
    const { entity: other } = await createOrganizationUser({
      organizationId: membership.organizationId,
    });
    const response = await resolve({
      targetModel: InquiryResourceModel.SpaceUser,
      targetSpaceId: membership.spaceId,
      targetUserId: other.userId,
    });
    expect(response.status).toBe(404);
    expect(
      (await resolve({ targetModel: InquiryResourceModel.SpaceUser, targetUserId: other.userId }))
        .status,
    ).toBe(422);
  });

  it('keeps Integration and Token targets out of request resolution', async () => {
    expect((await resolve({ targetModel: InquiryResourceModel.Integration })).status).toBe(422);
    expect((await resolve({ targetModel: InquiryResourceModel.Token })).status).toBe(422);
  });
});
