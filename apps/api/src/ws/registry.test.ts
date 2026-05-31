import { afterEach, describe, expect, it } from 'bun:test';
import { addConnection, byChannel, byId, byUser, clearRegistry, removeConnection } from '#/ws/registry';
import { subscribeToChannel } from '#/ws/subscriptions';
import { createTestSocket } from '#tests/createTestSocket';

afterEach(() => clearRegistry());

describe('registry', () => {
  it('addConnection indexes byId, and byUser when authenticated', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: 'u1' });
    addConnection(socket);
    expect(byId.get('c1')).toBe(socket);
    expect([...(byUser.get('u1') ?? [])]).toEqual(['c1']);
  });

  it('addConnection with no userId indexes only byId', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: null });
    addConnection(socket);
    expect(byId.has('c1')).toBe(true);
    expect(byUser.size).toBe(0);
  });

  it('removeConnection cleans byId, byUser, and every channel index', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: 'u1' });
    addConnection(socket);
    subscribeToChannel(socket, 'ch1');
    subscribeToChannel(socket, 'ch2');

    removeConnection(socket);

    expect(byId.has('c1')).toBe(false);
    expect(byUser.has('u1')).toBe(false);
    expect(byChannel.has('ch1')).toBe(false);
    expect(byChannel.has('ch2')).toBe(false);
  });

  it('keeps a shared set while it has members, drops it when empty', () => {
    const a = createTestSocket({ connectionId: 'a', userId: 'u1' });
    const b = createTestSocket({ connectionId: 'b', userId: 'u1' });
    addConnection(a.socket);
    addConnection(b.socket);

    removeConnection(a.socket);
    expect([...(byUser.get('u1') ?? [])]).toEqual(['b']);

    removeConnection(b.socket);
    expect(byUser.has('u1')).toBe(false);
  });

  it('clearRegistry empties everything', () => {
    const { socket } = createTestSocket({ userId: 'u1' });
    addConnection(socket);
    subscribeToChannel(socket, 'ch1');
    clearRegistry();
    expect(byId.size).toBe(0);
    expect(byUser.size).toBe(0);
    expect(byChannel.size).toBe(0);
  });
});
