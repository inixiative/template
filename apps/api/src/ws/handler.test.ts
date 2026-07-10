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

// Transport-level tests: the probe app is the injection seam — REAL route authorization is
// covered by probe.test.ts. This stand-in mirrors the contract: 401 without a credential,
// 404 for an id the caller may not read, 204 otherwise.
const CHANNEL_OK = 'inquiryRead:id:ok';
const CHANNEL_DENIED = 'inquiryRead:id:denied';
beforeEach(() =>
  setProbeApp({
    request: (path: string, init?: RequestInit) => {
      if (path === '/openapi/docs') {
        return Response.json({ paths: { '/api/v1/inquiry/{id}': { get: { operationId: 'inquiryRead' } } } });
      }
      if (!new Headers(init?.headers).get('authorization')) return new Response(null, { status: 401 });
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
