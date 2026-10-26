// canSubscribe/resolveIdentity dry-run the REAL app: real session auth, real spoof middleware,
// real permissions. Route auth IS channel auth, end to end.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import {
  InquiryResourceModel,
  InquiryStatus,
  InquiryType,
  PlatformRole,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createInquiry,
  createOrganization,
  createUser,
} from '@template/db/test';
import { STREAM_DEFINITIONS, WS_CHANNELS } from '@template/shared/ws';
import { canSubscribe, resolveIdentity } from '#/ws/probe';
import { createBearerToken } from '#tests/utils/createBearerToken';
import { createKeyedToken } from '#tests/utils/createKeyedToken';

describe('ws subscribe probe (real app)', () => {
  let superadmin: User;
  let targetUser: User;
  let adminBearer: { authorization: string };
  let inquiryId: string;
  let organizationBearer: { authorization: string };

  beforeAll(async () => {
    ({ entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin }));
    adminBearer = { authorization: (await createBearerToken(superadmin)).authorization };

    const { entity: sourceOrganization } = await createOrganization();
    ({ entity: targetUser } = await createUser());
    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: sourceOrganization.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: targetUser.id,
      content: { organizationId: sourceOrganization.id, role: 'member' },
    });
    inquiryId = inquiry.id;
    const { rawKey } = await createKeyedToken(
      { ownerModel: 'Organization', role: 'owner' },
      { organization: sourceOrganization },
    );
    organizationBearer = { authorization: `Bearer ${rawKey}` };
  });

  it("an organization's token is identified as a token, with no user", async () => {
    expect(await resolveIdentity(organizationBearer)).toMatchObject({
      status: 'resolved',
      model: 'Token',
      userId: null,
    });
  });

  it("an organization's token subscribes to what its permissions read", async () => {
    expect(await canSubscribe(organizationBearer, WS_CHANNELS.inquiryRead.name(inquiryId))).toBe(
      true,
    );
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it("a user subscribes to their own segment memberships, not someone else's", async () => {
    const { entity: user } = await createUser();
    const bearer = { authorization: (await createBearerToken(user)).authorization };
    expect(
      await canSubscribe(bearer, WS_CHANNELS.userReadManySegmentMemberships.name(user.id)),
    ).toBe(true);
    expect(
      await canSubscribe(bearer, WS_CHANNELS.userReadManySegmentMemberships.name(targetUser.id)),
    ).toBe(false);
  });

  it("a user's token subscribes to that user's segment memberships", async () => {
    const { entity: user } = await createUser();
    const key = randomUUID();
    await createToken(
      {
        ownerModel: 'User',
        role: 'owner',
        keyHash: createHash('sha256').update(key).digest('hex'),
      },
      { user },
    );
    expect(
      await canSubscribe(
        { authorization: `Bearer ${key}` },
        WS_CHANNELS.userReadManySegmentMemberships.name(user.id),
      ),
    ).toBe(true);
  });

  it('allows a channel whose route the connection could GET', async () => {
    expect(await canSubscribe(adminBearer, WS_CHANNELS.inquiryRead.name(inquiryId))).toBe(true);
  });

  it('rejects a channel for a resource the route 404s', async () => {
    const channel = WS_CHANNELS.inquiryRead.name('00000000-0000-0000-0000-000000000000');
    expect(await canSubscribe(adminBearer, channel)).toBe(false);
  });

  it('rejects a credentialless subscribe', async () => {
    expect(await canSubscribe({}, WS_CHANNELS.inquiryRead.name(inquiryId))).toBe(false);
  });

  it('rejects a channel outside the registry', async () => {
    expect(await canSubscribe(adminBearer, 'somethingElse:id:x')).toBe(false);
  });

  it('rejects a data stream family — streams are opened, not subscribed', async () => {
    expect(
      await canSubscribe(
        adminBearer,
        STREAM_DEFINITIONS.organizationReadManyContacts.name({ id: inquiryId }),
      ),
    ).toBe(false);
  });

  it('rejects a name that is only an inherited object key', async () => {
    expect(await canSubscribe(adminBearer, 'constructor')).toBe(false);
  });

  it('rejects a dot-segment param that would normalize onto another route', async () => {
    expect(await canSubscribe(adminBearer, 'inquiryRead:id:..')).toBe(false);
    expect(await canSubscribe(adminBearer, 'inquiryRead:id:.')).toBe(false);
  });

  it('rejects a malformed channel missing the route param', async () => {
    expect(await canSubscribe(adminBearer, 'inquiryRead')).toBe(false);
  });

  it('resolveIdentity answers a token as a token, with no user', async () => {
    expect(await resolveIdentity(adminBearer)).toMatchObject({
      status: 'resolved',
      model: 'Token',
      userId: null,
    });
  });

  it('resolveIdentity honors the spoof header — identity becomes the target', async () => {
    const me = await resolveIdentity({ ...adminBearer, 'x-spoof-user-email': targetUser.email });
    expect(me).toMatchObject({ status: 'resolved', model: 'User', userId: targetUser.id });
  });

  it('a spoofed probe carries the TARGET authority, not the admin', async () => {
    const { entity: outsider } = await createUser();
    const channel = WS_CHANNELS.inquiryRead.name(inquiryId);
    expect(
      await canSubscribe({ ...adminBearer, 'x-spoof-user-email': outsider.email }, channel),
    ).toBe(false);
    expect(
      await canSubscribe({ ...adminBearer, 'x-spoof-user-email': targetUser.email }, channel),
    ).toBe(true);
  });
});
