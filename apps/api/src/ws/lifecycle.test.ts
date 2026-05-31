import { afterEach, describe, expect, it } from 'bun:test';
import { cleanupStaleConnections, drainConnections, getConnectionStats, updateLastPing } from '#/ws/lifecycle';
import { addConnection, byId, clearRegistry } from '#/ws/registry';
import { subscribeToChannel } from '#/ws/subscriptions';
import { createTestSocket } from '#tests/createTestSocket';

afterEach(() => clearRegistry());

describe('lifecycle', () => {
  it('updateLastPing bumps the timestamp', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', lastPing: 0 });
    addConnection(socket);
    updateLastPing(socket);
    expect(socket.data.lastPing).toBeGreaterThan(0);
  });

  it('cleanupStaleConnections closes + removes stale, keeps fresh, returns the count', () => {
    const stale = createTestSocket({ connectionId: 'stale', lastPing: Date.now() - 10 * 60 * 1000 });
    const fresh = createTestSocket({ connectionId: 'fresh', lastPing: Date.now() });
    addConnection(stale.socket);
    addConnection(fresh.socket);

    const cleaned = cleanupStaleConnections();

    expect(cleaned).toBe(1);
    expect(byId.has('stale')).toBe(false);
    expect(byId.has('fresh')).toBe(true);
    expect(stale.closeInfo()?.reason).toBe('Connection stale');
  });

  it('getConnectionStats counts connections, users, and channels', () => {
    const a = createTestSocket({ connectionId: 'a', userId: 'u1' });
    addConnection(a.socket);
    subscribeToChannel(a.socket, 'ch1');
    expect(getConnectionStats()).toEqual({ connections: 1, users: 1, channels: 1 });
  });

  it('drainConnections notifies clients, closes them, and clears the registry', () => {
    const a = createTestSocket({ connectionId: 'a' });
    addConnection(a.socket);

    drainConnections();

    expect(JSON.parse(a.sent[0])).toEqual({ type: 'reconnect', reason: 'server_shutdown' });
    expect(a.closeInfo()?.reason).toBe('Server shutting down');
    expect(getConnectionStats().connections).toBe(0);
  });
});
