import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { websocketHandler } from '#/ws/handler';
import { setProbeApp } from '#/ws/probe';
import { byChannel, byId, clearRegistry } from '#/ws/registry';
import { createTestSocket } from '#tests/createTestSocket';

// Drives the REAL top-level handler with real frames and asserts the real
// outbound frames + registry effects. The socket is the outbound sink, not a
// behavior fake. Auth-dependent actions (authenticate/spoof) are covered
// separately — they hit better-auth + db.

afterEach(() => clearRegistry());

const lastFrame = (sent: string[]) => JSON.parse(sent[sent.length - 1]);

// Transport-level tests; real route auth + identity provenance live in probe.test.ts.
const CHANNEL_OK = 'inquiryRead:id:ok';
const CHANNEL_DENIED = 'inquiryRead:id:denied';
const VALID_TOKEN = 't1';
const UNSPOOFABLE = 'walled@x.com';
beforeEach(() =>
  setProbeApp({
    request: (path: string, init?: RequestInit) => {
      if (path === '/openapi/docs') {
        return Response.json({ paths: { '/api/v1/inquiry/{id}': { get: { operationId: 'inquiryRead' } } } });
      }
      const headers = new Headers(init?.headers);
      if (headers.get('authorization') !== `Bearer ${VALID_TOKEN}`) return new Response(null, { status: 401 });
      if (path === '/api/v1/me') {
        const spoof = headers.get('x-spoof-user-email');
        const email = spoof && spoof !== UNSPOOFABLE ? spoof : 'self@x.com';
        return Response.json({ data: { id: `id-${email}`, email } });
      }
      return new Response(null, { status: path.endsWith('/ok') ? 204 : 404 });
    },
  }),
);

describe('websocketHandler', () => {
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
    const { socket, sent } = createTestSocket({ connectionId: 'c1', userId: 'u1', token: 't1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'subscribe', channel: CHANNEL_OK }));
    expect([...(byChannel.get(CHANNEL_OK) ?? [])]).toEqual(['c1']);
    expect(lastFrame(sent)).toEqual({ type: 'subscribed', channel: CHANNEL_OK });
  });

  it('rejects a subscribe from a connection without a credential', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'subscribe', channel: CHANNEL_OK }));
    expect(byChannel.has(CHANNEL_OK)).toBe(false);
    expect(lastFrame(sent)).toEqual({ type: 'subscribeRejected', channel: CHANNEL_OK });
  });

  it('rejects a subscribe the route denies', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1', userId: 'u1', token: 't1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'subscribe', channel: CHANNEL_DENIED }));
    expect(byChannel.has(CHANNEL_DENIED)).toBe(false);
    expect(lastFrame(sent)).toEqual({ type: 'subscribeRejected', channel: CHANNEL_DENIED });
  });

  it('unsubscribe removes the channel and confirms', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1', userId: 'u1', token: 't1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'subscribe', channel: CHANNEL_OK }));
    await websocketHandler.message(socket, JSON.stringify({ action: 'unsubscribe', channel: CHANNEL_OK }));
    expect(byChannel.has(CHANNEL_OK)).toBe(false);
    expect(lastFrame(sent)).toEqual({ type: 'unsubscribed', channel: CHANNEL_OK });
  });

  it('ping bumps lastPing and pongs', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1', lastPing: 0 });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'ping' }));
    expect(socket.data.lastPing).toBeGreaterThan(0);
    expect(lastFrame(sent)).toEqual({ type: 'pong' });
  });

  it('authenticate resolves identity as provenance of the token (/me)', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'authenticate', token: VALID_TOKEN }));
    expect(socket.data.userId).toBe('id-self@x.com');
    expect(socket.data.token).toBe(VALID_TOKEN);
    expect(lastFrame(sent)).toEqual({ type: 'identity', userId: 'id-self@x.com' });
  });

  it('authenticate with a rejected token resolves to a null identity', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'authenticate', token: 'not-a-token' }));
    expect(socket.data.userId).toBeNull();
    expect(socket.data.token).toBeNull();
    expect(lastFrame(sent)).toEqual({ type: 'identity', userId: null });
  });

  it('spoof swaps identity to the target and remembers the spoof credential', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(
      socket,
      JSON.stringify({ action: 'spoof', token: VALID_TOKEN, email: 'target@x.com' }),
    );
    expect(socket.data.userId).toBe('id-target@x.com');
    expect(socket.data.spoofEmail).toBe('target@x.com');
    expect(lastFrame(sent)).toEqual({ type: 'identity', userId: 'id-target@x.com' });
  });

  it('rejects a spoof the API does not honor, keeping the previous state', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1', userId: 'id-self@x.com', token: VALID_TOKEN });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'spoof', token: VALID_TOKEN, email: UNSPOOFABLE }));
    expect(socket.data.userId).toBe('id-self@x.com');
    expect(socket.data.spoofEmail).toBeNull();
    expect(lastFrame(sent)).toEqual({ type: 'spoofRejected' });
  });

  it('unspoof restores the token identity and clears the spoof', async () => {
    const { socket, sent } = createTestSocket({
      connectionId: 'c1',
      userId: 'id-target@x.com',
      token: VALID_TOKEN,
      spoofEmail: 'target@x.com',
    });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'unspoof', token: VALID_TOKEN }));
    expect(socket.data.userId).toBe('id-self@x.com');
    expect(socket.data.spoofEmail).toBeNull();
    expect(lastFrame(sent)).toEqual({ type: 'identity', userId: 'id-self@x.com' });
  });

  it('logout clears identity to anonymous without a token', async () => {
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
