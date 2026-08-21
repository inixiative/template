import { afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createInquiry, createOrganization, createUser } from '@template/db/test';
import { InquiryResourceModel, InquiryStatus, InquiryType, PlatformRole } from '@template/db/generated/client/enums';
import { WS_CHANNELS } from '@template/shared/ws';
import { websocketHandler } from '#/ws/handler';
import { byChannel, byId, clearRegistry } from '#/ws/registry';
import { subscribeToChannel } from '#/ws/subscriptions';
import { createBearerToken } from '#tests/utils/createBearerToken';
import { createTestSocket } from '#tests/createTestSocket';

// Transport tests against the REAL app — probes are requests. Credentialed acceptance
// and spoof authority live in probe.test.ts.

const lastFrame = (sent: string[]) => JSON.parse(sent[sent.length - 1]);

const createAdminBearer = async () => {
  const { entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin });
  return (await createBearerToken(superadmin)).authorization;
};

const createTestInquiry = async () => {
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
  return inquiry;
};

describe('websocketHandler', () => {
  afterEach(async () => {
    clearRegistry();
    await cleanupTouchedTables(db);
  });

  it('open registers the connection and sends a connected frame', () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    expect(byId.has('c1')).toBe(true);
    expect(lastFrame(sent)).toEqual({ type: 'connected', connectionId: 'c1' });
  });

  it('close removes the connection', () => {
    const { socket } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    websocketHandler.close(socket);
    expect(byId.has('c1')).toBe(false);
  });

  it('subscribe indexes a probe-approved channel and confirms', async () => {
    const inquiry = await createTestInquiry();
    const channel = WS_CHANNELS.inquiryRead.name(inquiry.id);
    const authorization = await createAdminBearer();

    const { socket, sent } = createTestSocket({ connectionId: 'c1', headers: { authorization } });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'subscribe', channel }));
    expect([...(byChannel.get(channel) ?? [])]).toEqual(['c1']);
    expect(lastFrame(sent)).toEqual({ type: 'subscribed', channel });
  });

  it('rejects a subscribe from a connection without a credential', async () => {
    const inquiry = await createTestInquiry();
    const channel = WS_CHANNELS.inquiryRead.name(inquiry.id);

    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'subscribe', channel }));
    expect(byChannel.has(channel)).toBe(false);
    expect(lastFrame(sent)).toEqual({ type: 'subscribeRejected', channel });
  });

  it('rejects a subscribe to a channel outside the registry', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'subscribe', channel: 'nope:id:x' }));
    expect(byChannel.has('nope:id:x')).toBe(false);
    expect(lastFrame(sent)).toEqual({ type: 'subscribeRejected', channel: 'nope:id:x' });
  });

  it('unsubscribe removes the channel and confirms', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    subscribeToChannel(socket, 'ch1');
    await websocketHandler.message(socket, JSON.stringify({ action: 'unsubscribe', channel: 'ch1' }));
    expect(byChannel.has('ch1')).toBe(false);
    expect(lastFrame(sent)).toEqual({ type: 'unsubscribed', channel: 'ch1' });
  });

  it('ping bumps lastPing and pongs', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1', lastPing: 0 });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'ping' }));
    expect(socket.data.lastPing).toBeGreaterThan(0);
    expect(lastFrame(sent)).toEqual({ type: 'pong' });
  });

  it('authenticate resolves identity as provenance of the credential (/me)', async () => {
    const { entity: user } = await createUser();
    const { authorization } = await createBearerToken(user);

    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'authenticate', headers: { authorization } }));
    expect(socket.data.userId).toBe(user.id);
    expect(lastFrame(sent)).toEqual({ type: 'identity', userId: user.id });
  });

  it('authenticate with a rejected token resolves to a null identity', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(
      socket,
      JSON.stringify({ action: 'authenticate', headers: { authorization: 'Bearer not-a-token' } }),
    );
    expect(socket.data.userId).toBeNull();
    expect(lastFrame(sent)).toEqual({ type: 'identity', userId: null });
  });

  it('rejects a spoof the API does not honor, keeping the previous state', async () => {
    const { entity: user } = await createUser();
    const { entity: target } = await createUser();
    const { authorization } = await createBearerToken(user);

    const { socket, sent } = createTestSocket({ connectionId: 'c1', userId: user.id });
    websocketHandler.open(socket);
    await websocketHandler.message(
      socket,
      JSON.stringify({
        action: 'authenticate',
        headers: { authorization, 'x-spoof-user-email': target.email },
      }),
    );
    expect(socket.data.userId).toBe(user.id);
    expect(lastFrame(sent)).toEqual({ type: 'spoofRejected' });
  });

  it('logout clears identity to anonymous', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1', userId: 'u1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'logout' }));
    expect(socket.data.userId).toBeNull();
    expect(lastFrame(sent)).toEqual({ type: 'identity', userId: null });
  });

  it('drops a malformed frame without throwing or sending', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    const before = sent.length;
    await websocketHandler.message(socket, '{ not json');
    expect(sent.length).toBe(before);
  });
});
