import { afterEach, describe, expect, it } from 'bun:test';
import { addConnection, byChannel, byId, clearRegistry, removeConnection } from '#/ws/registry';
import { subscribeToChannel } from '#/ws/subscriptions';
import { createTestSocket } from '#tests/createTestSocket';

afterEach(() => clearRegistry());

describe('registry', () => {
  it('addConnection indexes byId', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: 'u1' });
    addConnection(socket);
    expect(byId.get('c1')).toBe(socket);
  });

  it('removeConnection cleans byId and every channel index', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: 'u1' });
    addConnection(socket);
    subscribeToChannel(socket, 'ch1');
    subscribeToChannel(socket, 'ch2');

    removeConnection(socket);

    expect(byId.has('c1')).toBe(false);
    expect(byChannel.has('ch1')).toBe(false);
    expect(byChannel.has('ch2')).toBe(false);
  });

  it('clearRegistry empties everything', () => {
    const { socket } = createTestSocket({ userId: 'u1' });
    addConnection(socket);
    subscribeToChannel(socket, 'ch1');
    clearRegistry();
    expect(byId.size).toBe(0);
    expect(byChannel.size).toBe(0);
  });
});
