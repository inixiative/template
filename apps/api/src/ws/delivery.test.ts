import { afterEach, describe, expect, it } from 'bun:test';
import { broadcastLocal, sendToChannelLocal, sendToStreamLocal, sendToUserLocal } from '#/ws/delivery';
import { addConnection, byId, clearRegistry } from '#/ws/registry';
import { subscribeToStream } from '#/ws/streamSubscriptions';
import { subscribeToChannel } from '#/ws/subscriptions';
import { createTestSocket } from '#tests/createTestSocket';

afterEach(() => clearRegistry());

const parse = (sent: string[]) => sent.map((m) => JSON.parse(m));

describe('delivery', () => {
  it('sendToChannelLocal delivers only to subscribers of that channel', () => {
    const a = createTestSocket({ connectionId: 'a' });
    const b = createTestSocket({ connectionId: 'b' });
    addConnection(a.socket);
    addConnection(b.socket);
    subscribeToChannel(a.socket, 'ch1');

    sendToChannelLocal('ch1', { type: 'query.refetch', queryKey: ['x'] });

    expect(parse(a.sent)).toEqual([{ type: 'query.refetch', queryKey: ['x'] }]);
    expect(b.sent).toEqual([]);
  });

  it('sendToUserLocal fans to all of a user’s sessions, no one else', () => {
    const a = createTestSocket({ connectionId: 'a', userId: 'u1' });
    const b = createTestSocket({ connectionId: 'b', userId: 'u1' });
    const c = createTestSocket({ connectionId: 'c', userId: 'u2' });
    addConnection(a.socket);
    addConnection(b.socket);
    addConnection(c.socket);

    sendToUserLocal('u1', { hi: true });

    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(1);
    expect(c.sent).toEqual([]);
  });

  it('broadcastLocal reaches every connection', () => {
    const a = createTestSocket({ connectionId: 'a' });
    const b = createTestSocket({ connectionId: 'b' });
    addConnection(a.socket);
    addConnection(b.socket);
    broadcastLocal({ ping: 1 });
    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(1);
  });

  it('removes a dead socket instead of sending — mid-iteration, without dropping the live one', () => {
    const live = createTestSocket({ connectionId: 'live' });
    const dead = createTestSocket({ connectionId: 'dead' });
    addConnection(live.socket);
    addConnection(dead.socket);
    subscribeToChannel(live.socket, 'ch1');
    subscribeToChannel(dead.socket, 'ch1');
    dead.markClosed();

    sendToChannelLocal('ch1', { x: 1 });

    expect(live.sent).toHaveLength(1);
    expect(dead.sent).toEqual([]);
    expect(byId.has('dead')).toBe(false);
    expect(byId.has('live')).toBe(true);
  });

  it('sendToStreamLocal delivers only to connections holding that stream open', () => {
    const a = createTestSocket({ connectionId: 'a' });
    const b = createTestSocket({ connectionId: 'b' });
    addConnection(a.socket);
    addConnection(b.socket);
    subscribeToStream(a.socket, 'st1');
    subscribeToChannel(b.socket, 'st1');

    sendToStreamLocal('st1', { category: 'data', action: 'append', stream: 'st1', type: 'upsert', payload: 1 });

    expect(parse(a.sent)).toEqual([{ category: 'data', action: 'append', stream: 'st1', type: 'upsert', payload: 1 }]);
    expect(b.sent).toEqual([]);
  });

  it('sendToStreamLocal with recipients skips holders outside them, including anonymous ones', () => {
    const alice = createTestSocket({ connectionId: 'alice', userId: 'u-alice' });
    const bob = createTestSocket({ connectionId: 'bob', userId: 'u-bob' });
    const anonymous = createTestSocket({ connectionId: 'anon', userId: null });
    for (const { socket } of [alice, bob, anonymous]) {
      addConnection(socket);
      subscribeToStream(socket, 'st1');
    }

    sendToStreamLocal('st1', { n: 1 }, ['u-alice']);

    expect(parse(alice.sent)).toEqual([{ n: 1 }]);
    expect(bob.sent).toEqual([]);
    expect(anonymous.sent).toEqual([]);
  });

  it('sendToStreamLocal holds a message for a connection whose snapshot is still in flight', () => {
    const priming = createTestSocket({ connectionId: 'priming' });
    const open = createTestSocket({ connectionId: 'open' });
    addConnection(priming.socket);
    addConnection(open.socket);
    subscribeToStream(priming.socket, 'st1');
    subscribeToStream(open.socket, 'st1');
    priming.socket.data.heldAppends.set('st1', []);

    sendToStreamLocal('st1', { n: 1 });

    expect(priming.sent).toEqual([]);
    expect(priming.socket.data.heldAppends.get('st1')).toEqual([JSON.stringify({ n: 1 })]);
    expect(parse(open.sent)).toEqual([{ n: 1 }]);
  });
});
