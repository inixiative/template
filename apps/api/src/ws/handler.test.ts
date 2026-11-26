import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { db } from '@template/db';
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
import { WS_CHANNELS } from '@template/shared/ws';
import { app } from '#/app';
import { websocketHandler } from '#/ws/handler';
import { meChannel } from '#/ws/meChannel';
import { reauthorizeOpenStreams } from '#/ws/reauthorizeOpenStreams';
import { clearRegistry, connectionIdsByChannel, connectionsById } from '#/ws/registry';
import { subscribeToChannel } from '#/ws/subscriptions';
import { createTestSocket, sentFrames } from '#tests/createTestSocket';
import { createBearerToken } from '#tests/utils/createBearerToken';

// Transport tests against the REAL app — probes are requests. Credentialed acceptance
// and spoof authority live in probe.test.ts.

const createAdminBearer = async () => {
  const { entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin });
  return (await createBearerToken(superadmin)).authorization;
};

const createTestInquiry = async (targetUserId?: string) => {
  const { entity: sourceOrganization } = await createOrganization();
  const resolvedTargetUserId = targetUserId ?? (await createUser()).entity.id;
  const { entity: inquiry } = await createInquiry({
    type: InquiryType.inviteOrganizationUser,
    status: InquiryStatus.sent,
    sourceModel: InquiryResourceModel.Organization,
    sourceOrganizationId: sourceOrganization.id,
    targetModel: InquiryResourceModel.User,
    targetUserId: resolvedTargetUserId,
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
    expect(connectionsById.has('c1')).toBe(true);
    expect(sentFrames(sent).at(-1)).toEqual({ type: 'connected', connectionId: 'c1' });
  });

  it('close removes the connection', () => {
    const { socket } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    websocketHandler.close(socket);
    expect(connectionsById.has('c1')).toBe(false);
  });

  it('subscribe indexes a probe-approved channel and confirms', async () => {
    const inquiry = await createTestInquiry();
    const channel = WS_CHANNELS.inquiryRead.name(inquiry.id);
    const authorization = await createAdminBearer();

    const { socket, sent } = createTestSocket({ connectionId: 'c1', headers: { authorization } });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'subscribe', channel }));
    expect([...(connectionIdsByChannel.get(channel) ?? [])]).toEqual(['c1']);
    expect(sentFrames(sent).at(-1)).toEqual({ type: 'subscribed', channel });
  });

  it("a /me channel is filed under the subscriber's user and confirmed by its own name", async () => {
    const { entity: user } = await createUser();
    const { authorization } = await createBearerToken(user);
    const channel = WS_CHANNELS.meReadManySegmentMemberships.name();

    const { socket, sent } = createTestSocket({
      connectionId: 'c1',
      userId: user.id,
      headers: { authorization },
    });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'subscribe', channel }));
    expect([...(connectionIdsByChannel.get(meChannel(channel, user.id)) ?? [])]).toEqual(['c1']);
    expect(connectionIdsByChannel.has(channel)).toBe(false);
    expect(sentFrames(sent).at(-1)).toEqual({ type: 'subscribed', channel });
  });

  it('rejects a subscribe from a connection without a credential', async () => {
    const inquiry = await createTestInquiry();
    const channel = WS_CHANNELS.inquiryRead.name(inquiry.id);

    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'subscribe', channel }));
    expect(connectionIdsByChannel.has(channel)).toBe(false);
    expect(sentFrames(sent).at(-1)).toEqual({ type: 'subscribeRejected', channel });
  });

  it('rejects a subscribe to a channel outside the registry', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(
      socket,
      JSON.stringify({ action: 'subscribe', channel: 'nope:id:x' }),
    );
    expect(connectionIdsByChannel.has('nope:id:x')).toBe(false);
    expect(sentFrames(sent).at(-1)).toEqual({ type: 'subscribeRejected', channel: 'nope:id:x' });
  });

  it('unsubscribe removes the channel and confirms', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    subscribeToChannel(socket, 'ch1');
    await websocketHandler.message(
      socket,
      JSON.stringify({ action: 'unsubscribe', channel: 'ch1' }),
    );
    expect(connectionIdsByChannel.has('ch1')).toBe(false);
    expect(sentFrames(sent).at(-1)).toEqual({ type: 'unsubscribed', channel: 'ch1' });
  });

  it('ping bumps lastPing and pongs', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1', lastPing: 0 });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'ping' }));
    expect(socket.data.lastPing).toBeGreaterThan(0);
    expect(sentFrames(sent).at(-1)).toEqual({ type: 'pong' });
  });

  it('answers ping even while the connection queue is blocked', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    void socket.data.queue.run(() => new Promise<void>(() => {}));

    await websocketHandler.message(socket, JSON.stringify({ action: 'ping' }));

    expect(sentFrames(sent).at(-1)).toEqual({ type: 'pong' });
  });

  it("authenticate keeps a user's token as its credential, acting for its user (/identify)", async () => {
    const { entity: user } = await createUser();
    const { authorization } = await createBearerToken(user);

    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(
      socket,
      JSON.stringify({ action: 'authenticate', headers: { authorization } }),
    );
    expect(socket.data.userId).toBe(user.id);
    expect(socket.data.headers.authorization).toBe(authorization);
    expect(sentFrames(sent).at(-1)).toEqual({ type: 'identity', userId: user.id });
  });

  it('authenticate with a rejected token resolves to a null identity', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(
      socket,
      JSON.stringify({ action: 'authenticate', headers: { authorization: 'Bearer not-a-token' } }),
    );
    expect(socket.data.userId).toBeNull();
    expect(sentFrames(sent).at(-1)).toEqual({ type: 'identity', userId: null });
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
    expect(sentFrames(sent).at(-1)).toEqual({ type: 'spoofRejected' });
  });

  it('logout clears identity to anonymous', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1', userId: 'u1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'logout' }));
    expect(socket.data.userId).toBeNull();
    expect(sentFrames(sent).at(-1)).toEqual({ type: 'identity', userId: null });
  });

  it('an authenticate resolving after close does not re-index the dead connection', async () => {
    const { entity: user } = await createUser();
    const { authorization } = await createBearerToken(user);

    const { socket } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    const pending = websocketHandler.message(
      socket,
      JSON.stringify({ action: 'authenticate', headers: { authorization } }),
    );
    websocketHandler.close(socket);
    await pending;

    expect(connectionsById.has('c1')).toBe(false);
  });

  it('a subscribe resolving after close does not re-index the dead connection', async () => {
    const inquiry = await createTestInquiry();
    const channel = WS_CHANNELS.inquiryRead.name(inquiry.id);
    const authorization = await createAdminBearer();

    const { socket } = createTestSocket({ connectionId: 'c1', headers: { authorization } });
    websocketHandler.open(socket);
    const pending = websocketHandler.message(
      socket,
      JSON.stringify({ action: 'subscribe', channel }),
    );
    websocketHandler.close(socket);
    await pending;

    expect(connectionsById.has('c1')).toBe(false);
    expect(connectionIdsByChannel.has(channel)).toBe(false);
  });

  it('drops a malformed frame without throwing or sending', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    const before = sent.length;
    await websocketHandler.message(socket, '{ not json');
    expect(sent.length).toBe(before);
  });

  it('reauthorizes subscribed channels and evicts revoked subscriptions including /me channels', async () => {
    const { entity: user } = await createUser();
    const { authorization, token } = await createBearerToken(user);
    const inquiry = await createTestInquiry(user.id);
    const inquiryChannel = WS_CHANNELS.inquiryRead.name(inquiry.id);
    const meWireChannel = WS_CHANNELS.meReadManySegmentMemberships.name();

    const { socket, sent } = createTestSocket({
      connectionId: 'c1',
      userId: user.id,
      headers: { authorization },
    });
    websocketHandler.open(socket);
    await websocketHandler.message(
      socket,
      JSON.stringify({ action: 'subscribe', channel: inquiryChannel }),
    );
    await websocketHandler.message(
      socket,
      JSON.stringify({ action: 'subscribe', channel: meWireChannel }),
    );
    sent.length = 0;

    await reauthorizeOpenStreams();
    expect(sentFrames(sent)).toEqual([]);
    expect(connectionIdsByChannel.has(inquiryChannel)).toBe(true);
    expect(connectionIdsByChannel.has(meChannel(meWireChannel, user.id))).toBe(true);

    await db.token.update({ where: { id: token.id }, data: { isActive: false } });
    await reauthorizeOpenStreams();

    expect(connectionIdsByChannel.has(inquiryChannel)).toBe(false);
    expect(connectionIdsByChannel.has(meChannel(meWireChannel, user.id))).toBe(false);
    expect(socket.data.channels.size).toBe(0);
    expect(sentFrames(sent)).toEqual([
      { type: 'subscribeRejected', channel: inquiryChannel },
      { type: 'subscribeRejected', channel: meWireChannel },
    ]);
  });

  it('emits retryable subscribe error when a channel re-probe returns 503', async () => {
    const inquiry = await createTestInquiry();
    const channel = WS_CHANNELS.inquiryRead.name(inquiry.id);
    const authorization = await createAdminBearer();

    const { socket, sent } = createTestSocket({ connectionId: 'c1', headers: { authorization } });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'subscribe', channel }));
    sent.length = 0;

    const spy = spyOn(app, 'request').mockImplementationOnce((() =>
      Promise.resolve(new Response('busy', { status: 503 }))) as never);
    try {
      await reauthorizeOpenStreams();
    } finally {
      spy.mockRestore();
    }

    expect(connectionIdsByChannel.has(channel)).toBe(false);
    expect(sentFrames(sent)).toEqual([
      { type: 'error', action: 'subscribe', channel, retryable: true },
    ]);
  });
});
