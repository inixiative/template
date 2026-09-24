import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import '@template/ui/store';
import { QueryClient, QueryObserver, skipToken } from '@tanstack/react-query';
import { WS_FRAME_LIMIT, type WSFrameErrorFrame, type WSStreamAckFrame } from '@template/shared/ws';
import { type ApiWebsocketTiming, createApiWebsocket } from '@template/ui/lib/ws/createApiWebsocket';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';
import { useAppStore } from '@template/ui/store';

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
const opensOf = (ws: FakeWebSocket) => sends(ws).filter((frame) => frame.action === 'open');
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fastTiming: Partial<ApiWebsocketTiming> = {
  retryBaseMs: 5,
  retryMaxMs: 20,
  openAckTimeoutMs: 30,
  pacedInFlight: 100,
  pacedPerSecond: 1_000,
};

describe('createApiWebsocket', () => {
  let wsSpy: ReturnType<typeof spyOn>;
  beforeEach(() => {
    instances = [];
    wsSpy = spyOn(globalThis, 'WebSocket').mockImplementation(((url: string) => new FakeWebSocket(url)) as never);
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
    const ws = instances[0] as FakeWebSocket;
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
    const ws = instances[0] as FakeWebSocket;
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
    const ws = instances[0] as FakeWebSocket;
    open(ws);

    api.subscribe('ch1');
    ws.sent.length = 0;
    open(ws);

    expect(reconnected).toBe(0);
    receive(ws, { type: 'subscribed', channel: 'ch1' });
    expect(reconnected).toBe(1);
  });

  it('re-sends a subscribe the server dropped for load', async () => {
    const api = createApiWebsocket('ws://x', undefined, fastTiming);
    api.connect();
    const ws = instances[0] as FakeWebSocket;
    open(ws);
    api.subscribe('ch1');
    ws.sent.length = 0;

    receive(ws, { type: 'error', action: 'subscribe', channel: 'ch1', retryable: true } satisfies WSFrameErrorFrame);
    await wait(20);

    expect(sends(ws)).toEqual([{ action: 'subscribe', channel: 'ch1' }]);
  });

  it('re-sends an identity frame the server dropped for load, then replays grants under it', async () => {
    const api = createApiWebsocket('ws://x', undefined, fastTiming);
    api.connect();
    const ws = instances[0] as FakeWebSocket;
    open(ws);
    api.subscribe('ch1');
    api.authenticate('tok');
    ws.sent.length = 0;

    receive(ws, { type: 'error', action: 'authenticate', retryable: true } satisfies WSFrameErrorFrame);
    await wait(20);

    expect(sends(ws)[0]).toEqual({ action: 'authenticate', headers: { authorization: 'Bearer tok' } });
    expect(sends(ws)).toContainEqual({ action: 'subscribe', channel: 'ch1' });
  });

  describe('data streams', () => {
    const stream = 'organizationReadManyContacts:id:org-1';
    let client: QueryClient;
    beforeEach(() => {
      client = new QueryClient();
      useAppStore.setState({ client });
    });

    const connected = (timing: Partial<ApiWebsocketTiming> = fastTiming) => {
      const api = createApiWebsocket('ws://x', undefined, timing);
      api.connect();
      const ws = instances[0] as FakeWebSocket;
      open(ws);
      return { api, ws };
    };

    const observe = () =>
      new QueryObserver(client, { queryKey: dataStreamQueryKey(stream), queryFn: skipToken }).subscribe(() => {});

    const snapshotFrame = { category: 'data', action: 'snapshot', stream, payload: { data: [] } };

    it('opens once per stream across holders and closes when the last holder releases it', () => {
      const { api, ws } = connected();
      api.open(stream);
      api.open(stream);
      api.close(stream);
      expect(opensOf(ws)).toEqual([{ action: 'open', stream }]);
      expect(sends(ws).some((frame) => frame.action === 'close')).toBe(false);

      api.close(stream);
      expect(sends(ws).at(-1)).toEqual({ action: 'close', stream });
    });

    it('re-opens held streams after identity on reconnect, for a fresh snapshot', () => {
      const { api, ws } = connected();
      api.authenticate('tok');
      api.open(stream);
      ws.sent.length = 0;
      open(ws);

      expect(sends(ws)).toEqual([
        { action: 'authenticate', headers: { authorization: 'Bearer tok' } },
        { action: 'open', stream },
      ]);
    });

    it('replays identity, then subscribes, then opens', () => {
      const { api, ws } = connected();
      api.authenticate('tok');
      api.open(stream);
      api.subscribe('ch1');
      ws.sent.length = 0;
      open(ws);

      expect(sends(ws).map((frame) => frame.action)).toEqual(['authenticate', 'subscribe', 'open']);
    });

    it('re-opens held streams on an identity change so they are re-authorized', () => {
      const { api, ws } = connected();
      api.open(stream);
      ws.sent.length = 0;
      api.logout();

      expect(sends(ws)).toEqual([{ action: 'logout' }, { action: 'open', stream }]);
    });

    it('drops a rejected stream from replay and wipes its data', () => {
      const unobserve = observe();
      const { api, ws } = connected();
      api.open(stream);
      receive(ws, { type: 'opened', stream } satisfies WSStreamAckFrame);
      receive(ws, snapshotFrame);

      receive(ws, { type: 'openRejected', stream } satisfies WSStreamAckFrame);
      const state = client.getQueryState(dataStreamQueryKey(stream));
      expect(state?.status).toBe('error');
      expect(state?.data).toBeUndefined();

      ws.sent.length = 0;
      open(ws);
      expect(opensOf(ws)).toEqual([]);
      unobserve();
    });

    it('ignores data frames for a stream it no longer holds', () => {
      const { api, ws } = connected();
      api.open(stream);
      api.close(stream);

      receive(ws, snapshotFrame);

      expect(client.getQueryData<unknown>(dataStreamQueryKey(stream))).toBeUndefined();
    });

    it('routes a data frame by category, even when its action type collides with a control frame', () => {
      const { api, ws } = connected();
      api.open(stream);
      receive(ws, { type: 'opened', stream });
      receive(ws, { category: 'data', action: 'append', stream, type: 'openRejected', payload: {} });

      ws.sent.length = 0;
      open(ws);
      expect(opensOf(ws)).toEqual([{ action: 'open', stream }]);
    });

    it('routes a held stream snapshot into its query', () => {
      const { api, ws } = connected();
      api.open(stream);

      receive(ws, snapshotFrame);

      expect(client.getQueryData<unknown>(dataStreamQueryKey(stream))).toEqual({ data: [] });
    });

    it('never sends an open ahead of the identity frame on a connection that is not yet open', () => {
      const api = createApiWebsocket('ws://x', undefined, fastTiming);
      api.connect();
      const ws = instances[0] as FakeWebSocket;
      api.authenticate('tok');
      api.open(stream);
      open(ws);

      const actions = sends(ws).map((frame) => frame.action);
      expect(actions.filter((action) => action === 'open')).toHaveLength(1);
      expect(actions.indexOf('authenticate')).toBeLessThan(actions.indexOf('open'));
    });

    it('ignores a rejection answering an open that a later open superseded', () => {
      const unobserve = observe();
      const { api, ws } = connected();
      api.open(stream);
      api.authenticate('tok');

      receive(ws, { type: 'openRejected', stream });
      receive(ws, { type: 'opened', stream });
      receive(ws, snapshotFrame);

      expect(client.getQueryState(dataStreamQueryKey(stream))?.status).toBe('success');
      unobserve();
    });

    it('keeps its holder count across a rejection, and a new holder retries the open', () => {
      const { api, ws } = connected();
      api.open(stream);
      api.open(stream);
      receive(ws, { type: 'openRejected', stream });

      api.open(stream);
      api.close(stream);

      expect(opensOf(ws)).toHaveLength(2);
      expect(sends(ws).some((frame) => frame.action === 'close')).toBe(false);
    });

    it('retries a retryable open error with backoff on the same connection, keeping the last snapshot', async () => {
      const unobserve = observe();
      const { api, ws } = connected();
      api.open(stream);
      receive(ws, { type: 'opened', stream });
      receive(ws, snapshotFrame);
      ws.sent.length = 0;

      receive(ws, { type: 'error', action: 'open', stream, retryable: true } satisfies WSFrameErrorFrame);
      const state = client.getQueryState(dataStreamQueryKey(stream));
      expect(state?.status).toBe('error');
      expect(state?.data).toEqual({ data: [] });

      await wait(15);
      expect(opensOf(ws)).toEqual([{ action: 'open', stream }]);
      unobserve();
    });

    it('doubles the retry delay on each consecutive retryable failure and resets once opened', async () => {
      const random = spyOn(Math, 'random').mockReturnValue(1);
      try {
        const { api, ws } = connected({ ...fastTiming, retryBaseMs: 20, retryMaxMs: 1_000, openAckTimeoutMs: 10_000 });
        api.open(stream);
        const fail = () => receive(ws, { type: 'error', action: 'open', stream, retryable: true });

        fail();
        await wait(25);
        expect(opensOf(ws)).toHaveLength(2);

        fail();
        await wait(25);
        expect(opensOf(ws)).toHaveLength(2);
        await wait(25);
        expect(opensOf(ws)).toHaveLength(3);

        receive(ws, { type: 'opened', stream });
        fail();
        await wait(25);
        expect(opensOf(ws)).toHaveLength(4);
      } finally {
        random.mockRestore();
      }
    });

    it('treats an unanswered open as failed after the ack timeout and retries it', async () => {
      const unobserve = observe();
      const { api, ws } = connected();
      api.open(stream);

      await wait(35);
      expect(client.getQueryState(dataStreamQueryKey(stream))?.status).toBe('error');
      await wait(25);
      expect(opensOf(ws).length).toBeGreaterThanOrEqual(2);
      unobserve();
    });

    it('closes a stream the server stops authorizing mid-stream', () => {
      const unobserve = observe();
      const { api, ws } = connected();
      api.open(stream);
      receive(ws, { type: 'opened', stream });
      receive(ws, snapshotFrame);

      receive(ws, { type: 'openRejected', stream });

      expect(client.getQueryState(dataStreamQueryKey(stream))?.data).toBeUndefined();
      receive(ws, snapshotFrame);
      expect(client.getQueryState(dataStreamQueryKey(stream))?.data).toBeUndefined();
      unobserve();
    });

    it('paces a large reconnect replay so the server never holds more than the in-flight window', () => {
      const { api, ws } = connected({ ...fastTiming, pacedInFlight: 4, pacedPerSecond: 1_000 });
      const names = Array.from({ length: 12 }, (_, i) => `organizationReadManyContacts:id:org-${i}`);
      for (const name of names) api.open(name);
      for (let i = 0; i < 12; i++) api.subscribe(`ch${i}`);
      ws.sent.length = 0;
      open(ws);

      expect(sends(ws).filter((frame) => frame.action !== 'authenticate')).toHaveLength(4);
      for (let i = 0; i < 12; i++) receive(ws, { type: 'subscribed', channel: `ch${i}` });
      for (const name of names) receive(ws, { type: 'opened', stream: name });

      expect(sends(ws).filter((frame) => frame.action === 'subscribe')).toHaveLength(12);
      expect(opensOf(ws)).toHaveLength(12);
      const actions = sends(ws).map((frame) => frame.action);
      expect(actions.indexOf('open')).toBeGreaterThan(actions.lastIndexOf('subscribe'));
    });

    it('paces opens to the per-second budget', async () => {
      const { api, ws } = connected({ ...fastTiming, pacedInFlight: 100, pacedPerSecond: 3, openAckTimeoutMs: 10_000 });
      for (let i = 0; i < 5; i++) api.open(`organizationReadManyContacts:id:org-${i}`);

      expect(opensOf(ws)).toHaveLength(3);
      await wait(1_050);
      expect(opensOf(ws)).toHaveLength(5);
    });

    it('resync re-opens a live stream once, and never a rejected one', () => {
      const { api, ws } = connected();
      api.open(stream);
      receive(ws, { type: 'opened', stream });
      ws.sent.length = 0;

      api.resync(stream);
      api.resync(stream);
      expect(opensOf(ws)).toEqual([{ action: 'open', stream }]);

      receive(ws, { type: 'openRejected', stream });
      ws.sent.length = 0;
      api.resync(stream);
      expect(opensOf(ws)).toEqual([]);
    });
  });
  describe('adversarial review', () => {
    const stream = 'organizationReadManyContacts:id:org-1';
    beforeEach(() => useAppStore.setState({ client: new QueryClient() }));

    const connected = (timing: Partial<ApiWebsocketTiming> = fastTiming) => {
      const api = createApiWebsocket('ws://x', undefined, timing);
      api.connect();
      const ws = instances[0] as FakeWebSocket;
      open(ws);
      return { api, ws };
    };

    it('re-sends a close the server dropped for load while the stream stays released', async () => {
      const { api, ws } = connected();
      api.open(stream);
      receive(ws, { type: 'opened', stream });
      api.close(stream);
      ws.sent.length = 0;

      receive(ws, { type: 'error', action: 'close', stream, retryable: true } satisfies WSFrameErrorFrame);
      await wait(20);

      expect(sends(ws)).toEqual([{ action: 'close', stream }]);
    });

    it('re-sends an unsubscribe the server dropped for load', async () => {
      const { api, ws } = connected();
      api.subscribe('ch1');
      receive(ws, { type: 'subscribed', channel: 'ch1' });
      api.unsubscribe('ch1');
      ws.sent.length = 0;

      receive(ws, {
        type: 'error',
        action: 'unsubscribe',
        channel: 'ch1',
        retryable: true,
      } satisfies WSFrameErrorFrame);
      await wait(20);

      expect(sends(ws)).toEqual([{ action: 'unsubscribe', channel: 'ch1' }]);
    });

    it('open/close churn with default pacing stays inside the server frame budget', () => {
      const { api, ws } = connected({});
      for (let i = 0; i < 130; i++) {
        api.open(`organizationReadManyContacts:id:churn-${i}`);
        api.close(`organizationReadManyContacts:id:churn-${i}`);
      }
      expect(ws.sent.length).toBeLessThanOrEqual(WS_FRAME_LIMIT / 2);
    });

    it('backs off identity re-sends after repeated load drops', async () => {
      const random = spyOn(Math, 'random').mockReturnValue(1);
      try {
        const { api, ws } = connected({ ...fastTiming, retryBaseMs: 20, retryMaxMs: 1_000 });
        api.authenticate('tok');
        const drop = () => receive(ws, { type: 'error', action: 'authenticate', retryable: true });
        const identities = () => sends(ws).filter((frame) => frame.action === 'authenticate').length;

        drop();
        await wait(25);
        expect(identities()).toBe(2);
        drop();
        await wait(25);
        expect(identities()).toBe(2);
        await wait(25);
        expect(identities()).toBe(3);
      } finally {
        random.mockRestore();
      }
    });
  });
});
