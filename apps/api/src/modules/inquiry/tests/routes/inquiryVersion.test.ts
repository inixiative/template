import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Inquiry, Organization, User } from '@template/db/generated/client/client';
import {
  InquiryResourceModel,
  InquiryStatus,
  InquiryType,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createInquiry,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import { inquiryRouter } from '#/modules/inquiry';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { del, json, patch, post } from '#tests/utils/request';

const mount: MountFn[] = [(app) => app.route('/api/v1/inquiry', inquiryRouter)];

describe('acting on an inquiry carries the version the actor saw', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let organization: Organization;
  let owner: User;
  let ownerFetch: ReturnType<typeof createTestApp>['fetch'];

  const invite = async (invitee: User, status: InquiryStatus = InquiryStatus.sent) =>
    (
      await createInquiry({
        type: InquiryType.inviteOrganizationUser,
        status,
        sourceModel: InquiryResourceModel.Organization,
        sourceOrganizationId: organization.id,
        targetModel: InquiryResourceModel.User,
        targetUserId: invitee.id,
        content: { role: 'member' },
      })
    ).entity;

  const stale = new Date('2000-01-01T00:00:00.000Z').toISOString();

  beforeAll(async () => {
    owner = (await createUser()).entity;
    organization = (await createOrganization()).entity;
    const { entity: membership } = await createOrganizationUser(
      { role: 'owner' },
      { user: owner, organization },
    );
    const harness = createTestApp({ mockUser: owner, mockOrganizationUsers: [membership], mount });
    ownerFetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('resolve with the current version succeeds', async () => {
    const invitee = (await createUser()).entity;
    const inquiry = await invite(invitee);
    const response = await createTestApp({ mockUser: invitee, mount }).fetch(
      post(`/api/v1/inquiry/${inquiry.id}/resolve`, {
        status: 'approved',
        expectedUpdatedAt: inquiry.updatedAt.toISOString(),
      }),
    );
    expect(response.status).toBe(200);
  });

  it('resolve with a stale version is a 409', async () => {
    const invitee = (await createUser()).entity;
    const inquiry = await invite(invitee);
    const response = await createTestApp({ mockUser: invitee, mount }).fetch(
      post(`/api/v1/inquiry/${inquiry.id}/resolve`, {
        status: 'approved',
        expectedUpdatedAt: stale,
      }),
    );
    expect(response.status).toBe(409);
  });

  it('resolve without a version is refused', async () => {
    const invitee = (await createUser()).entity;
    const inquiry = await invite(invitee);
    const response = await createTestApp({ mockUser: invitee, mount }).fetch(
      post(`/api/v1/inquiry/${inquiry.id}/resolve`, { status: 'approved' }),
    );
    expect(response.status).toBe(422);
  });

  it('an edit between read and approve makes the approval a 409', async () => {
    const invitee = (await createUser()).entity;
    const inquiry = await invite(invitee);
    const seen = inquiry.updatedAt.toISOString();

    const edited = await ownerFetch(
      patch(`/api/v1/inquiry/${inquiry.id}`, {
        content: { role: 'admin' },
        expectedUpdatedAt: seen,
      }),
    );
    expect(edited.status).toBe(200);

    const response = await createTestApp({ mockUser: invitee, mount }).fetch(
      post(`/api/v1/inquiry/${inquiry.id}/resolve`, {
        status: 'approved',
        expectedUpdatedAt: seen,
      }),
    );
    expect(response.status).toBe(409);
    const unchanged = await db.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
    expect(unchanged.status).toBe(InquiryStatus.sent);
  });

  it('update, send and cancel check the version too', async () => {
    const invitee = (await createUser()).entity;
    const draft = await invite(invitee, InquiryStatus.draft);

    expect(
      (
        await ownerFetch(
          patch(`/api/v1/inquiry/${draft.id}`, {
            content: { role: 'member' },
            expectedUpdatedAt: stale,
          }),
        )
      ).status,
    ).toBe(409);
    expect(
      (await ownerFetch(post(`/api/v1/inquiry/${draft.id}/send`, { expectedUpdatedAt: stale })))
        .status,
    ).toBe(409);
    expect(
      (
        await ownerFetch(
          del(`/api/v1/inquiry/${draft.id}/cancel?expectedUpdatedAt=${encodeURIComponent(stale)}`),
        )
      ).status,
    ).toBe(409);

    const sent = await ownerFetch(
      post(`/api/v1/inquiry/${draft.id}/send`, {
        expectedUpdatedAt: draft.updatedAt.toISOString(),
      }),
    );
    expect(sent.status).toBe(200);
    const { data } = await json<Inquiry>(sent);
    expect(
      (
        await ownerFetch(
          del(
            `/api/v1/inquiry/${draft.id}/cancel?expectedUpdatedAt=${encodeURIComponent(String(data.updatedAt))}`,
          ),
        )
      ).status,
    ).toBe(204);
  });
});
