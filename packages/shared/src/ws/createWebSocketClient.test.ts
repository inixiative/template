import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { createWebSocketClient } from '@template/shared/ws';

const CLOSE_EVENT_DELAY_MS = 5;

class LateClosingSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readyState = LateClosingSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor() {
    sockets.push(this);
  }
  send(): void {}
  close(): void {
    this.readyState = LateClosingSocket.CLOSING;
    setTimeout(() => {
      this.readyState = LateClosingSocket.CLOSED;
      this.onclose?.();
    }, CLOSE_EVENT_DELAY_MS);
  }
}

let sockets: LateClosingSocket[] = [];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('createWebSocketClient', () => {
  let socketSpy: ReturnType<typeof spyOn>;
  beforeEach(() => {
    sockets = [];
    socketSpy = spyOn(globalThis, 'WebSocket').mockImplementation(
      (() => new LateClosingSocket()) as never,
    );
    Object.assign(socketSpy, {
      CONNECTING: LateClosingSocket.CONNECTING,
      OPEN: LateClosingSocket.OPEN,
      CLOSING: LateClosingSocket.CLOSING,
      CLOSED: LateClosingSocket.CLOSED,
    });
  });
  afterEach(() => {
    socketSpy.mockRestore();
  });

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
    (sockets[0] as LateClosingSocket).close();
    await wait(CLOSE_EVENT_DELAY_MS * 4);
    expect(sockets).toHaveLength(2);
    client.close();
  });
});
