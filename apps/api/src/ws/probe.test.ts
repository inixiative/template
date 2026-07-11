// canSubscribe/resolveIdentity dry-run real routes, so these mount the actual inquiry read +
// me routes (with spoofMiddleware) and assert route auth IS channel auth.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { User } from '@template/db';
import { InquiryResourceModel, InquiryStatus, InquiryType, PlatformRole } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createInquiry, createOrganization, createUser } from '@template/db/test';
import { WS_CHANNELS } from '@template/shared/ws';
import { spoofMiddleware } from '#/middleware/auth/spoofMiddleware';
import { inquiryRouter } from '#/modules/inquiry';
import { meRouter } from '#/modules/me';
import { canSubscribe, resolveIdentity, setProbeApp } from '#/ws/probe';
import { createTestApp } from '#tests/createTestApp';

describe('ws subscribe probe', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let superadmin: User;
  let targetUser: User;
  let inquiryId: string;

  beforeAll(async () => {
    ({ entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin }));
    const harness = createTestApp({
      mockUser: superadmin,
      mount: [
        (app) => {
          app.use('/api/*', spoofMiddleware);
          app.route('/api/v1/me', meRouter);
          app.route('/api/v1/inquiry', inquiryRouter);
        },
      ],
    });
    harness.app.doc31('/openapi/docs', { openapi: '3.1.0', info: { title: 'test', version: '0' } });
    setProbeApp({ request: (path, init) => harness.fetch(new Request(`http://test${path}`, init)) });
    db = harness.db;

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
    const ok = await canSubscribe({ authorization: 'Bearer t' }, WS_CHANNELS.inquiryRead.name(inquiryId));
    expect(ok).toBe(true);
  });

  it('rejects a channel for a resource the route 404s', async () => {
    const channel = WS_CHANNELS.inquiryRead.name('00000000-0000-0000-0000-000000000000');
    expect(await canSubscribe({ authorization: 'Bearer t' }, channel)).toBe(false);
  });

  it('rejects a channel outside the registry', async () => {
    expect(await canSubscribe({ authorization: 'Bearer t' }, 'somethingElse:id:x')).toBe(false);
  });

  it('rejects a malformed channel missing the route param', async () => {
    expect(await canSubscribe({ authorization: 'Bearer t' }, 'inquiryRead')).toBe(false);
  });

  it('resolveIdentity returns the token user as provenance of /me', async () => {
    const me = await resolveIdentity({ authorization: 'Bearer t' });
    expect(me?.id).toBe(superadmin.id);
  });

  it('resolveIdentity honors the spoof header — identity becomes the target', async () => {
    const me = await resolveIdentity({ authorization: 'Bearer t', 'x-spoof-user-email': targetUser.email });
    expect(me?.id).toBe(targetUser.id);
  });

  it('a spoofed probe carries the TARGET authority, not the admin', async () => {
    const { entity: outsider } = await createUser();
    const channel = WS_CHANNELS.inquiryRead.name(inquiryId);
    expect(await canSubscribe({ authorization: 'Bearer t', 'x-spoof-user-email': outsider.email }, channel)).toBe(false);
    expect(await canSubscribe({ authorization: 'Bearer t', 'x-spoof-user-email': targetUser.email }, channel)).toBe(true);
  });
});
