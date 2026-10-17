import { afterEach, describe, expect, it } from 'bun:test';
import { setIdentity } from '#/ws/identity';
import { addConnection, byUser, clearRegistry } from '#/ws/registry';
import { subscribeToStream } from '#/ws/streamSubscriptions';
import { subscribeToChannel } from '#/ws/subscriptions';
import { createTestSocket } from '#tests/createTestSocket';

afterEach(() => clearRegistry());

describe('setIdentity', () => {
  it('indexes an anonymous connection under a new userId (authenticate)', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: null });
    addConnection(socket);
    setIdentity(socket, 'u1', {});
    expect(socket.data.userId).toBe('u1');
    expect([...(byUser.get('u1') ?? [])]).toEqual(['c1']);
  });

  it('re-indexes when switching identity (spoof): deindex old, index new', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: 'real' });
    addConnection(socket);
    setIdentity(socket, 'spoofed', {});
    expect(byUser.has('real')).toBe(false);
    expect([...(byUser.get('spoofed') ?? [])]).toEqual(['c1']);
  });

  it('clears identity to anonymous (logout)', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: 'u1' });
    addConnection(socket);
    setIdentity(socket, null, {});
    expect(socket.data.userId).toBeNull();
    expect(byUser.has('u1')).toBe(false);
  });

  it('is a no-op when the identity is unchanged', () => {
    const { socket } = createTestSocket({ connectionId: 'c1', userId: 'u1' });
    addConnection(socket);
    setIdentity(socket, 'u1', {});
    expect([...(byUser.get('u1') ?? [])]).toEqual(['c1']);
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
    expect([...(byUser.get('u1') ?? [])]).toEqual(['c1']);
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

  it('keeps multiple sessions (tabs/devices) under one userId', () => {
    const a = createTestSocket({ connectionId: 'a', userId: null });
    const b = createTestSocket({ connectionId: 'b', userId: null });
    addConnection(a.socket);
    addConnection(b.socket);
    setIdentity(a.socket, 'u1', {});
    setIdentity(b.socket, 'u1', {});
    expect([...(byUser.get('u1') ?? [])].sort()).toEqual(['a', 'b']);
  });
});
