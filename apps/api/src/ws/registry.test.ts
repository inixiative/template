import { afterEach, describe, expect, it } from 'bun:test';
import {
  addConnection,
  clearRegistry,
  connectionIdsByChannel,
  connectionsById,
  removeConnection,
} from '#/ws/registry';
import { subscribeToChannel } from '#/ws/subscriptions';
import { createTestSocket } from '#tests/createTestSocket';

afterEach(() => clearRegistry());

describe('registry', () => {
  it('addConnection indexes connectionsById', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: 'u1' });
    addConnection(socket);
    expect(connectionsById.get('c1')).toBe(socket);
  });

  it('removeConnection cleans connectionsById and every channel index', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: 'u1' });
    addConnection(socket);
    subscribeToChannel(socket, 'ch1');
    subscribeToChannel(socket, 'ch2');

    removeConnection(socket);

    expect(connectionsById.has('c1')).toBe(false);
    expect(connectionIdsByChannel.has('ch1')).toBe(false);
    expect(connectionIdsByChannel.has('ch2')).toBe(false);
  });

  it('clearRegistry empties everything', () => {
    const { socket } = createTestSocket({ userId: 'u1' });
    addConnection(socket);
    subscribeToChannel(socket, 'ch1');
    clearRegistry();
    expect(connectionsById.size).toBe(0);
    expect(connectionIdsByChannel.size).toBe(0);
  });
});
