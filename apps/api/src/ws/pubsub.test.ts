import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { initWebSocketPubSub, isPubSubEnabled, sendToChannel } from '#/ws/pubsub';
import { addConnection, clearRegistry } from '#/ws/registry';
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
});
