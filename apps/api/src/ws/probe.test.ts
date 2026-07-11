// canSubscribe/resolveIdentity dry-run the REAL app: real session auth, real spoof middleware,
// real permissions. Route auth IS channel auth, end to end.
import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { User } from '@template/db';
import { db } from '@template/db';
import { InquiryResourceModel, InquiryStatus, InquiryType, PlatformRole } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createInquiry, createOrganization, createToken, createUser } from '@template/db/test';
import { WS_CHANNELS } from '@template/shared/ws';
import { canSubscribe, resolveIdentity } from '#/ws/probe';

// Raw API key whose hash matches a real Token row — the same credential MCP-style callers use.
const createBearerFor = async (user: User): Promise<string> => {
  const rawKey = randomBytes(24).toString('hex');
  await createToken(
    { keyHash: createHash('sha256').update(rawKey).digest('hex'), keyPrefix: rawKey.slice(0, 16) },
    { user },
  );
  return `Bearer ${rawKey}`;
};

describe('ws subscribe probe (real app)', () => {
  let superadmin: User;
  let targetUser: User;
  let adminBearer: { authorization: string };
  let inquiryId: string;

  beforeAll(async () => {
    ({ entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin }));
    adminBearer = { authorization: await createBearerFor(superadmin) };

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
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
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

  it('rejects a malformed channel missing the route param', async () => {
    expect(await canSubscribe(adminBearer, 'inquiryRead')).toBe(false);
  });

  it('resolveIdentity returns the token user as provenance of /me', async () => {
    const me = await resolveIdentity(adminBearer);
    expect(me?.id).toBe(superadmin.id);
  });

  it('resolveIdentity honors the spoof header — identity becomes the target', async () => {
    const me = await resolveIdentity({ ...adminBearer, 'x-spoof-user-email': targetUser.email });
    expect(me?.id).toBe(targetUser.id);
  });

  it('a spoofed probe carries the TARGET authority, not the admin', async () => {
    const { entity: outsider } = await createUser();
    const channel = WS_CHANNELS.inquiryRead.name(inquiryId);
    expect(await canSubscribe({ ...adminBearer, 'x-spoof-user-email': outsider.email }, channel)).toBe(false);
    expect(await canSubscribe({ ...adminBearer, 'x-spoof-user-email': targetUser.email }, channel)).toBe(true);
  });
});
