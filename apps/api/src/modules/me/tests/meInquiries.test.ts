import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Inquiry, User } from '@template/db';
import { InquiryResourceModel, InquiryStatus, InquiryType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createInquiry, createUser } from '@template/db/test';
import { meRouter } from '#/modules/me';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

type InquiryList = { data: Inquiry[]; pagination: unknown };

const mount = [(app: any) => app.route('/api/v1/me', meRouter)];

describe('GET /api/v1/me/inquiries/sent', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let otherUser: User;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    user = u;
    const { entity: other } = await createUser();
    otherUser = other;

    const harness = createTestApp({ mockUser: user, mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('returns only own sent inquiries', async () => {
    const { entity: target } = await createUser();

    const { entity: mine } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.User,
      sourceUserId: user.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: target.id,
      content: { role: 'member' },
    });

    await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.User,
      sourceUserId: otherUser.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: target.id,
      content: { role: 'member' },
    });

    const response = await fetch(get('/api/v1/me/inquiries/sent'));
    const { data } = await json<InquiryList>(response);

    expect(response.status).toBe(200);
    expect(data.some((i) => i.id === mine.id)).toBe(true);
    expect(data.every((i) => i.sourceUserId === user.id)).toBe(true);
  });
});

describe('GET /api/v1/me/inquiries/received', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let otherUser: User;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    user = u;
    const { entity: other } = await createUser();
    otherUser = other;

    const harness = createTestApp({ mockUser: user, mount });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('returns only own received inquiries (non-draft)', async () => {
    const { entity: sender } = await createUser();

    const { entity: mine } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.User,
      sourceUserId: sender.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: user.id,
      content: { role: 'member' },
    });

    await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.draft,
      sourceModel: InquiryResourceModel.User,
      sourceUserId: sender.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: user.id,
      content: { role: 'member' },
    });

    await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.User,
      sourceUserId: sender.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: otherUser.id,
      content: { role: 'member' },
    });

    const response = await fetch(get('/api/v1/me/inquiries/received'));
    const { data } = await json<InquiryList>(response);

    expect(response.status).toBe(200);
    expect(data.some((i) => i.id === mine.id)).toBe(true);
    expect(data.every((i) => i.targetUserId === user.id)).toBe(true);
    expect(data.every((i) => i.status !== InquiryStatus.draft)).toBe(true);
  });
});
