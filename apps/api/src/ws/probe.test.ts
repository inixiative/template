/**
 * Integration tests for probe-based subscribe authorization: canSubscribe dry-runs the channel's
 * route with the connection's credential, so these mount the REAL inquiry read route and assert
 * that route auth IS channel auth.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { InquiryResourceModel, InquiryStatus, InquiryType, PlatformRole } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createInquiry, createOrganization, createUser } from '@template/db/test';
import { WS_CHANNELS } from '@template/shared/ws';
import { inquiryRouter } from '#/modules/inquiry';
import { canSubscribe, setProbeApp } from '#/ws/probe';
import { createTestApp } from '#tests/createTestApp';

describe('ws subscribe probe', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let inquiryId: string;

  beforeAll(async () => {
    const { entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin });
    const harness = createTestApp({
      mockUser: superadmin,
      mount: [(app) => app.route('/api/v1/inquiry', inquiryRouter)],
    });
    harness.app.doc31('/openapi/docs', { openapi: '3.1.0', info: { title: 'test', version: '0' } });
    // Through harness.fetch so the probe rides the same middleware chain as traffic.
    setProbeApp({ request: (path, init) => harness.fetch(new Request(`http://test${path}`, init)) });
    db = harness.db;

    const { entity: sourceOrganization } = await createOrganization();
    const { entity: targetUser } = await createUser();
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
    expect(await canSubscribe('token', WS_CHANNELS.inquiryRead.name(inquiryId))).toBe(true);
  });

  it('rejects a channel for a nonexistent resource — the route 404s the probe', async () => {
    expect(await canSubscribe('token', WS_CHANNELS.inquiryRead.name('00000000-0000-0000-0000-000000000000'))).toBe(
      false,
    );
  });

  it('rejects a channel outside the registry', async () => {
    expect(await canSubscribe('token', 'somethingElse:id:x')).toBe(false);
  });

  it('rejects a malformed channel missing the route param', async () => {
    expect(await canSubscribe('token', 'inquiryRead')).toBe(false);
  });
});
