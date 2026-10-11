import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { getRedisPub } from '@template/db';

import { appendToStream, initWebSocketPubSub, isPubSubEnabled, sendToChannel } from '#/ws/pubsub';
import { publishStreamAppend } from '#/ws/queries/publishStreamAppend';
import { addConnection, clearRegistry } from '#/ws/registry';
import { pendingStreamQueues } from '#/ws/streamPublishOrder';
import { subscribeToStream } from '#/ws/streamSubscriptions';
import { subscribeToChannel } from '#/ws/subscriptions';
import { createTestSocket } from '#tests/createTestSocket';

const waitFor = async (predicate: () => boolean, timeoutMs = 3000): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('ws pubsub (redis round trip)', () => {
  beforeEach(async () => {
    await initWebSocketPubSub();
  });

  afterEach(() => clearRegistry());

  it('delivers a published channel message to a locally registered socket via redis', async () => {
    expect(isPubSubEnabled()).toBe(true);

    const handle = createTestSocket({ connectionId: 'pubsub-a' });
    addConnection(handle.socket);
    subscribeToChannel(handle.socket, 'pubsub:round-trip');

    await sendToChannel('pubsub:round-trip', { type: 'query.refetch', queryKey: ['pubsub'] });

    await waitFor(() => handle.sent.length > 0);
    expect(JSON.parse(handle.sent[0]!)).toEqual({ type: 'query.refetch', queryKey: ['pubsub'] });
  });

  it('does not deliver to sockets subscribed to other channels', async () => {
    const handle = createTestSocket({ connectionId: 'pubsub-b' });
    addConnection(handle.socket);
    subscribeToChannel(handle.socket, 'pubsub:other');

    await sendToChannel('pubsub:elsewhere', { type: 'query.refetch', queryKey: ['pubsub'] });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(handle.sent).toEqual([]);
  });

  it('delivers a stream append to a locally open stream via redis, wrapped in its data frame', async () => {
    const handle = createTestSocket({ connectionId: 'pubsub-stream' });
    addConnection(handle.socket);
    subscribeToStream(handle.socket, 'pubsub:stream');

    await appendToStream('pubsub:stream', { type: 'upsert', payload: { id: 'x' } });

    await waitFor(() => handle.sent.length > 0);
    expect(JSON.parse(handle.sent[0]!)).toEqual({
      category: 'data',
      action: 'append',
      stream: 'pubsub:stream',
      seq: expect.any(Number),
      type: 'upsert',
      payload: { id: 'x' },
    });
  });

  it('publishes one stream in emission order, each append one seq past the last', async () => {
    const handle = createTestSocket({ connectionId: 'pubsub-order' });
    addConnection(handle.socket);
    subscribeToStream(handle.socket, 'pubsub:ordered');

    await Promise.all(
      [1, 2, 3].map((n) => appendToStream('pubsub:ordered', { type: 'upsert', payload: { n } })),
    );
    await waitFor(() => handle.sent.length === 3);

    const frames = handle.sent.map((message) => JSON.parse(message));
    expect(frames.map((frame) => frame.payload.n)).toEqual([1, 2, 3]);
    expect(frames.map((frame) => frame.seq - frames[0].seq)).toEqual([0, 1, 2]);
    expect(pendingStreamQueues()).toBe(0);
  });

  it('two instances publishing one stream share its counter, so arrival order is seq order with no gaps', async () => {
    const handle = createTestSocket({ connectionId: 'pubsub-instances' });
    addConnection(handle.socket);
    subscribeToStream(handle.socket, 'pubsub:shared');
    // Each instance has its own per-stream queue, so their publishes interleave freely at Redis.
    const instance = (name: string) => (n: number) =>
      publishStreamAppend(getRedisPub(), 'ws:broadcast', 'pubsub:shared', {
        type: 'stream',
        target: 'pubsub:shared',
        append: { type: 'upsert', payload: { name, n } },
      });
    const a = instance('a');
    const b = instance('b');

    await Promise.all([1, 2, 3, 4, 5].flatMap((n) => [a(n), b(n)]));
    await waitFor(() => handle.sent.length === 10);

    const seqs = handle.sent.map((message) => JSON.parse(message).seq as number);
    expect(seqs.map((seq) => seq - (seqs[0] as number))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('an append Redis cannot sequence closes the stream on local holders as retryable', async () => {
    const handle = createTestSocket({ connectionId: 'pubsub-down' });
    addConnection(handle.socket);
    subscribeToStream(handle.socket, 'pubsub:down');
    const redis = getRedisPub();
    const spy = spyOn(redis, 'eval').mockImplementation((() =>
      Promise.reject(new Error('redis down'))) as never);
    try {
      await appendToStream('pubsub:down', { type: 'upsert', payload: { id: 'x' } });
      await waitFor(() => handle.sent.length > 0);
    } finally {
      spy.mockRestore();
    }

    expect(handle.sent.map((message) => JSON.parse(message))).toEqual([
      { type: 'error', action: 'open', stream: 'pubsub:down', retryable: true },
    ]);
    expect(handle.socket.data.streams.has('pubsub:down')).toBe(false);
    expect(pendingStreamQueues()).toBe(0);
  });

  it('delivers a per-recipient append only to the targeted users', async () => {
    const alice = createTestSocket({ connectionId: 'pubsub-alice', userId: 'alice' });
    const bob = createTestSocket({ connectionId: 'pubsub-bob', userId: 'bob' });
    for (const { socket } of [alice, bob]) {
      addConnection(socket);
      subscribeToStream(socket, 'pubsub:recipients');
    }

    await appendToStream('pubsub:recipients', { type: 'upsert', payload: { id: 'x' } }, ['alice']);

    await waitFor(() => alice.sent.length > 0);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(bob.sent).toEqual([]);
  });
});
