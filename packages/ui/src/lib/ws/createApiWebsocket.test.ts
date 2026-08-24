import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import '@template/ui/store';
import { createApiWebsocket } from '@template/ui/lib/ws/createApiWebsocket';

let instances: FakeWebSocket[] = [];

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  url: string;
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  constructor(url: string) {
    this.url = url;
    instances.push(this);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

const open = (ws: FakeWebSocket): void => {
  ws.readyState = FakeWebSocket.OPEN;
  ws.onopen?.();
};
const receive = (ws: FakeWebSocket, frame: unknown): void => ws.onmessage?.({ data: JSON.stringify(frame) });
const sends = (ws: FakeWebSocket): Array<Record<string, unknown>> => ws.sent.map((s) => JSON.parse(s));

describe('createApiWebsocket', () => {
  let wsSpy: ReturnType<typeof spyOn>;
  beforeEach(() => {
    instances = [];
    wsSpy = spyOn(globalThis, 'WebSocket').mockImplementation(
      ((url: string) => new FakeWebSocket(url)) as unknown as typeof WebSocket,
    );
    Object.assign(wsSpy, {
      CONNECTING: FakeWebSocket.CONNECTING,
      OPEN: FakeWebSocket.OPEN,
      CLOSING: FakeWebSocket.CLOSING,
      CLOSED: FakeWebSocket.CLOSED,
    });
  });
  afterEach(() => {
    wsSpy.mockRestore();
  });

  it('drops a subscription the server rejects so it is not replayed on reconnect', () => {
    const api = createApiWebsocket('ws://x');
    api.connect();
    const ws = instances[0];
    open(ws);

    api.subscribe('ch1');
    expect(sends(ws)).toContainEqual({ action: 'subscribe', channel: 'ch1' });

    receive(ws, { type: 'subscribeRejected', channel: 'ch1' });
    ws.sent.length = 0;
    open(ws);

    expect(sends(ws).some((frame) => frame.action === 'subscribe' && frame.channel === 'ch1')).toBe(false);
  });

  it('falls back to real identity when the server rejects a spoof', () => {
    const api = createApiWebsocket('ws://x');
    api.connect();
    const ws = instances[0];
    open(ws);

    api.spoof('tok', 'a@example.com');
    receive(ws, { type: 'spoofRejected' });

    expect(sends(ws).at(-1)).toEqual({ action: 'authenticate', headers: { authorization: 'Bearer tok' } });

    ws.sent.length = 0;
    open(ws);

    expect(sends(ws)).toContainEqual({ action: 'authenticate', headers: { authorization: 'Bearer tok' } });
    expect(sends(ws).some((frame) => (frame.headers as Record<string, unknown>)?.['x-spoof-user-email'])).toBe(false);
  });

  it('defers onReconnect until replayed subscriptions are acked', () => {
    let reconnected = 0;
    const api = createApiWebsocket('ws://x', () => {
      reconnected++;
    });
    api.connect();
    const ws = instances[0];
    open(ws);

    api.subscribe('ch1');
    ws.sent.length = 0;
    open(ws);

    expect(reconnected).toBe(0);
    receive(ws, { type: 'subscribed', channel: 'ch1' });
    expect(reconnected).toBe(1);
  });
});
