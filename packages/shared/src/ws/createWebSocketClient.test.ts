import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  type FakeBrowserWebSocket,
  installFakeBrowserWebSocket,
} from '@template/shared/test/fakeBrowserWebSocket';
import { waitFor } from '@template/shared/test/waitFor';
import { createWebSocketClient } from '@template/shared/ws';

const CLOSE_EVENT_DELAY_MS = 5;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('createWebSocketClient', () => {
  let fakeSocket: ReturnType<typeof installFakeBrowserWebSocket>;
  let sockets: FakeBrowserWebSocket[];
  beforeEach(() => {
    fakeSocket = installFakeBrowserWebSocket({ closeDelayMs: CLOSE_EVENT_DELAY_MS });
    sockets = fakeSocket.sockets;
  });
  afterEach(() => fakeSocket.restore());

  it('reports a close once, when close() is called, and never against the socket that replaced it', async () => {
    const closes: number[] = [];
    const client = createWebSocketClient({
      url: 'ws://x',
      onClose: () => closes.push(sockets.length),
    });

    client.connect();
    client.close();
    expect(closes).toEqual([1]);

    client.connect();
    await wait(CLOSE_EVENT_DELAY_MS * 4);

    expect(sockets).toHaveLength(2);
    expect(closes).toEqual([1]);
    expect(client.status()).toBe('connecting');
    client.close();
  });

  it('does not reconnect after close()', async () => {
    const client = createWebSocketClient({ url: 'ws://x', reconnectDelayMs: 1 });
    client.connect();
    client.close();
    await wait(CLOSE_EVENT_DELAY_MS * 4);
    expect(sockets).toHaveLength(1);
  });

  it('reconnects on its own when the server closes the socket', async () => {
    const client = createWebSocketClient({ url: 'ws://x', reconnectDelayMs: 1 });
    client.connect();
    (sockets[0] as FakeBrowserWebSocket).close();
    await waitFor(() => sockets.length === 2);
    client.close();
  });
});
