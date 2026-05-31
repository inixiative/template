import { afterEach, describe, expect, it } from 'bun:test';
import { addConnection, byChannel, clearRegistry } from '#/ws/registry';
import { subscribeToChannel, unsubscribeFromChannel } from '#/ws/subscriptions';
import { createTestSocket } from '#tests/createTestSocket';

afterEach(() => clearRegistry());

describe('subscriptions', () => {
  it('subscribe adds to the connection set and the channel index', () => {
    const { socket } = createTestSocket({ connectionId: 'c1' });
    addConnection(socket);
    subscribeToChannel(socket, 'ch1');
    expect(socket.data.channels.has('ch1')).toBe(true);
    expect([...(byChannel.get('ch1') ?? [])]).toEqual(['c1']);
  });

  it('unsubscribe removes from both', () => {
    const { socket } = createTestSocket({ connectionId: 'c1' });
    addConnection(socket);
    subscribeToChannel(socket, 'ch1');
    unsubscribeFromChannel(socket, 'ch1');
    expect(socket.data.channels.has('ch1')).toBe(false);
    expect(byChannel.has('ch1')).toBe(false);
  });

  it('multiple connections share a channel; removing one leaves the other', () => {
    const a = createTestSocket({ connectionId: 'a' });
    const b = createTestSocket({ connectionId: 'b' });
    addConnection(a.socket);
    addConnection(b.socket);
    subscribeToChannel(a.socket, 'ch1');
    subscribeToChannel(b.socket, 'ch1');
    expect([...(byChannel.get('ch1') ?? [])].sort()).toEqual(['a', 'b']);

    unsubscribeFromChannel(a.socket, 'ch1');
    expect([...(byChannel.get('ch1') ?? [])]).toEqual(['b']);
  });
});
