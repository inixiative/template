import { afterEach, describe, expect, it } from 'bun:test';
import { setIdentity } from '#/ws/identity';
import { addConnection, clearRegistry } from '#/ws/registry';
import { subscribeToStream } from '#/ws/streamSubscriptions';
import { subscribeToChannel } from '#/ws/subscriptions';
import { createTestSocket } from '#tests/createTestSocket';

afterEach(() => clearRegistry());

describe('setIdentity', () => {
  it('sets the userId of an anonymous connection (authenticate)', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: null });
    addConnection(socket);
    setIdentity(socket, 'u1', {});
    expect(socket.data.userId).toBe('u1');
  });

  it('switches identity (spoof) and drops grants', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: 'real' });
    addConnection(socket);
    subscribeToChannel(socket, 'ch1');
    setIdentity(socket, 'spoofed', {});
    expect(socket.data.userId).toBe('spoofed');
    expect(socket.data.channels.size).toBe(0);
  });

  it('clears identity to anonymous (logout)', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: 'u1' });
    addConnection(socket);
    setIdentity(socket, null, {});
    expect(socket.data.userId).toBeNull();
  });

  it('is a no-op when the identity is unchanged', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: 'u1' });
    addConnection(socket);
    subscribeToChannel(socket, 'ch1');
    setIdentity(socket, 'u1', {});
    expect(socket.data.channels.has('ch1')).toBe(true);
  });

  it('drops grants when the same user switches credentials', () => {
    const { socket } = createTestSocket({
      connectionId: 'c1',
      userId: 'u1',
      headers: { authorization: 'Bearer wide' },
    });
    addConnection(socket);
    subscribeToChannel(socket, 'ch1');
    subscribeToStream(socket, 'st1');

    setIdentity(socket, 'u1', { authorization: 'Bearer narrow' });

    expect(socket.data.headers).toEqual({ authorization: 'Bearer narrow' });
    expect(socket.data.channels.size).toBe(0);
    expect(socket.data.streams.size).toBe(0);
  });

  it('keeps grants when the same user re-sends the same credential', () => {
    const { socket } = createTestSocket({
      connectionId: 'c1',
      userId: 'u1',
      headers: { authorization: 'Bearer same' },
    });
    addConnection(socket);
    subscribeToStream(socket, 'st1');

    setIdentity(socket, 'u1', { authorization: 'Bearer same' });

    expect(socket.data.streams.has('st1')).toBe(true);
  });
});
