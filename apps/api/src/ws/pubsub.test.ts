import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { getRedisPub } from '@template/db';

import { appendToStream, initWebSocketPubSub, isPubSubEnabled, sendToChannel } from '#/ws/pubsub';
import { publishStreamAppend } from '#/ws/queries/publishStreamAppend';
import { addConnection, clearRegistry } from '#/ws/registry';
import { pendingStreamQueues } from '#/ws/streamPublishOrder';
import { streamSeqKey } from '#/ws/streamSeq';
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
      publishStreamAppend(getRedisPub(), 'ws:broadcast', [streamSeqKey('pubsub:shared')], {
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

  it('an append Redis cannot sequence is re-published as a resync until Redis takes it', async () => {
    const redis = getRedisPub();
    const evalSpy = spyOn(redis, 'eval').mockImplementation((() =>
      Promise.reject(new Error('redis down'))) as never);
    const realPublish = redis.publish.bind(redis);
    const published: string[] = [];
    let attempts = 0;
    const publishSpy = spyOn(redis, 'publish').mockImplementation(((
      channel: string,
      message: string,
    ) => {
      if (++attempts === 1) return Promise.reject(new Error('redis down'));
      published.push(message);
      return realPublish(channel, message);
    }) as never);
    try {
      await appendToStream('pubsub:remote', { type: 'upsert', payload: { id: 'x' } });
      await appendToStream('pubsub:remote', { type: 'upsert', payload: { id: 'y' } });
      await waitFor(() => published.length > 0);
      await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      evalSpy.mockRestore();
      publishSpy.mockRestore();
    }

    expect(published.map((message) => JSON.parse(message))).toEqual([
      { type: 'streamResync', target: 'pubsub:remote', origin: expect.any(String) },
    ]);
  });

  it('a resync queued while another is publishing goes out in the same run', async () => {
    const redis = getRedisPub();
    const evalSpy = spyOn(redis, 'eval').mockImplementation((() =>
      Promise.reject(new Error('redis down'))) as never);
    const realPublish = redis.publish.bind(redis);
    const published: string[] = [];
    let releaseFirst = () => {};
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let calls = 0;
    const publishSpy = spyOn(redis, 'publish').mockImplementation((async (
      channel: string,
      message: string,
    ) => {
      if (calls++ === 0) await firstHeld;
      published.push(message);
      return realPublish(channel, message);
    }) as never);
    try {
      await appendToStream('pubsub:resync-first', { type: 'upsert', payload: { id: 'x' } });
      await appendToStream('pubsub:resync-second', { type: 'upsert', payload: { id: 'y' } });
      releaseFirst();
      await waitFor(() => published.length === 2, 500);
    } finally {
      evalSpy.mockRestore();
      publishSpy.mockRestore();
    }

    expect(published.map((message) => JSON.parse(message).target)).toEqual([
      'pubsub:resync-first',
      'pubsub:resync-second',
    ]);
  });

  it('a resync from another instance closes the stream on local holders as retryable', async () => {
    const handle = createTestSocket({ connectionId: 'pubsub-foreign-resync' });
    addConnection(handle.socket);
    subscribeToStream(handle.socket, 'pubsub:foreign');

    await getRedisPub().publish(
      'ws:broadcast',
      JSON.stringify({ type: 'streamResync', target: 'pubsub:foreign', origin: 'other-instance' }),
    );
    await waitFor(() => handle.sent.length > 0);

    expect(handle.sent.map((message) => JSON.parse(message))).toEqual([
      { type: 'error', action: 'open', stream: 'pubsub:foreign', retryable: true },
    ]);
  });

  it('counts a per-recipient stream per user, so an append for one user is no gap for another', async () => {
    const alice = createTestSocket({ connectionId: 'pubsub-seq-alice', userId: 'alice' });
    const bob = createTestSocket({ connectionId: 'pubsub-seq-bob', userId: 'bob' });
    for (const { socket } of [alice, bob]) {
      addConnection(socket);
      subscribeToStream(socket, 'pubsub:per-user');
    }

    await appendToStream('pubsub:per-user', { type: 'upsert', payload: { n: 1 } }, [
      'alice',
      'bob',
    ]);
    await appendToStream('pubsub:per-user', { type: 'upsert', payload: { n: 2 } }, ['alice']);
    await appendToStream('pubsub:per-user', { type: 'upsert', payload: { n: 3 } }, [
      'alice',
      'bob',
    ]);
    await waitFor(() => alice.sent.length === 3 && bob.sent.length === 2);

    const seqs = (sent: string[]) => sent.map((message) => JSON.parse(message).seq as number);
    const consecutive = (numbers: number[]) => numbers.map((seq) => seq - (numbers[0] as number));
    expect(consecutive(seqs(alice.sent))).toEqual([0, 1, 2]);
    expect(consecutive(seqs(bob.sent))).toEqual([0, 1]);
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
