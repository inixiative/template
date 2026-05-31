import { afterEach, describe, expect, it } from 'bun:test';
import { websocketHandler } from '#/ws/handler';
import { byChannel, byId, clearRegistry } from '#/ws/registry';
import { createTestSocket } from '#tests/createTestSocket';

// Drives the REAL top-level handler with real frames and asserts the real
// outbound frames + registry effects. The socket is the outbound sink, not a
// behavior fake. Auth-dependent actions (authenticate/spoof) are covered
// separately — they hit better-auth + db.

afterEach(() => clearRegistry());

const lastFrame = (sent: string[]) => JSON.parse(sent[sent.length - 1]);

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

  it('subscribe indexes the channel and confirms', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'subscribe', channel: 'ch1' }));
    expect([...(byChannel.get('ch1') ?? [])]).toEqual(['c1']);
    expect(lastFrame(sent)).toEqual({ type: 'subscribed', channel: 'ch1' });
  });

  it('unsubscribe removes the channel and confirms', async () => {
    const { socket, sent } = createTestSocket({ connectionId: 'c1' });
    websocketHandler.open(socket);
    await websocketHandler.message(socket, JSON.stringify({ action: 'subscribe', channel: 'ch1' }));
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
