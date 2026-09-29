import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { getRedisPub } from '@template/db';

import { appendToStream, initWebSocketPubSub, isPubSubEnabled, sendToChannel } from '#/ws/pubsub';
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
      type: 'upsert',
      payload: { id: 'x' },
    });
  });

  it('publishes one stream in emission order even when an earlier publish falls back to local delivery', async () => {
    const handle = createTestSocket({ connectionId: 'pubsub-order' });
    addConnection(handle.socket);
    subscribeToStream(handle.socket, 'pubsub:ordered');
    const redis = getRedisPub();
    const realPublish = redis.publish.bind(redis);
    let calls = 0;
    const spy = spyOn(redis, 'publish').mockImplementation(((channel: string, message: string) =>
      ++calls === 1
        ? new Promise((_, reject) => setTimeout(() => reject(new Error('redis down')), 50))
        : realPublish(channel, message)) as never);
    try {
      const first = appendToStream('pubsub:ordered', { type: 'upsert', payload: { n: 1 } });
      const second = appendToStream('pubsub:ordered', { type: 'upsert', payload: { n: 2 } });
      await Promise.all([first, second]);
      await waitFor(() => handle.sent.length === 2);
    } finally {
      spy.mockRestore();
    }

    expect(handle.sent.map((message) => JSON.parse(message).payload.n)).toEqual([1, 2]);
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
