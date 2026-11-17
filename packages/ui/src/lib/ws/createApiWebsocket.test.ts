import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient, QueryObserver, skipToken } from '@tanstack/react-query';
import {
  FakeBrowserWebSocket,
  installFakeBrowserWebSocket,
} from '@template/shared/test/fakeBrowserWebSocket';
import { waitFor } from '@template/shared/test/waitFor';
import type { WSFrameErrorFrame, WSStreamAckFrame } from '@template/shared/ws';
import {
  type ApiWebsocket,
  type ApiWebsocketTiming,
  createApiWebsocket,
} from '@template/ui/lib/ws/createApiWebsocket';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';

const opensOf = (ws: FakeBrowserWebSocket) =>
  ws.sentFrames().filter((frame) => frame.action === 'open');
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fastTiming: Partial<ApiWebsocketTiming> = {
  retryBaseMs: 5,
  retryMaxMs: 20,
  openAckTimeoutMs: 10_000,
  streamSettleMs: 1,
};
const waitForOpensSent = (ws: FakeBrowserWebSocket, count: number) =>
  waitFor(() => opensOf(ws).length === count);
const recordTimers = () => {
  const delays: number[] = [];
  const pending = new Set<ReturnType<typeof setTimeout>>();
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const setSpy = spyOn(globalThis, 'setTimeout').mockImplementation(((
    callback: () => void,
    ms?: number,
  ) => {
    delays.push(ms ?? 0);
    const id = realSetTimeout(() => {
      pending.delete(id);
      callback();
    }, ms);
    pending.add(id);
    return id;
  }) as never);
  const clearSpy = spyOn(globalThis, 'clearTimeout').mockImplementation(((
    id: ReturnType<typeof setTimeout>,
  ) => {
    pending.delete(id);
    realClearTimeout(id);
  }) as never);
  return {
    delays,
    pending,
    restore: () => {
      setSpy.mockRestore();
      clearSpy.mockRestore();
    },
  };
};

let queryClient: QueryClient | null = null;
const clients: ApiWebsocket[] = [];
const createClient = (
  url: string,
  onReconnect?: () => void,
  timing?: Partial<ApiWebsocketTiming>,
): ApiWebsocket => {
  const client = createApiWebsocket(url, { getClient: () => queryClient, onReconnect }, timing);
  clients.push(client);
  return client;
};

describe('createApiWebsocket', () => {
  let fakeSocket: ReturnType<typeof installFakeBrowserWebSocket>;
  let instances: FakeBrowserWebSocket[];
  beforeEach(() => {
    fakeSocket = installFakeBrowserWebSocket();
    instances = fakeSocket.sockets;
  });
  afterEach(() => {
    for (const client of clients.splice(0)) client.disconnect();
    queryClient = null;
    fakeSocket.restore();
  });

  it('disconnect closes the socket and stays closed until connect is called again', async () => {
    const api = createClient('ws://x', undefined, {
      ...fastTiming,
      heartbeatMs: 2,
      pongTimeoutMs: 4,
    });
    api.connect();
    const ws = instances[0] as FakeBrowserWebSocket;
    ws.open();
    await waitFor(() => ws.sentFrames().some((frame) => frame.action === 'ping'));

    api.disconnect();
    expect(ws.readyState).toBe(FakeBrowserWebSocket.CLOSED);
    await wait(20);
    expect(instances).toHaveLength(1);

    api.connect();
    expect(instances).toHaveLength(2);
  });

  it('replays its subscriptions on the socket opened after a disconnect', () => {
    const api = createClient('ws://x');
    api.connect();
    (instances[0] as FakeBrowserWebSocket).open();
    api.subscribe('ch1');

    api.disconnect();
    api.connect();
    const second = instances[1] as FakeBrowserWebSocket;
    second.open();

    expect(second.sentFrames()).toContainEqual({ action: 'subscribe', channel: 'ch1' });
  });

  it('drops a subscription the server rejects so it is not replayed on reconnect', () => {
    const api = createClient('ws://x');
    api.connect();
    const ws = instances[0] as FakeBrowserWebSocket;
    ws.open();

    api.subscribe('ch1');
    expect(ws.sentFrames()).toContainEqual({ action: 'subscribe', channel: 'ch1' });

    ws.receive({ type: 'subscribeRejected', channel: 'ch1' });
    ws.sent.length = 0;
    ws.open();

    expect(
      ws.sentFrames().some((frame) => frame.action === 'subscribe' && frame.channel === 'ch1'),
    ).toBe(false);
  });

  it('falls back to real identity when the server rejects a spoof', () => {
    const api = createClient('ws://x');
    api.connect();
    const ws = instances[0] as FakeBrowserWebSocket;
    ws.open();

    api.spoof('tok', 'a@example.com');
    ws.receive({ type: 'spoofRejected' });

    expect(ws.sentFrames().at(-1)).toEqual({
      action: 'authenticate',
      headers: { authorization: 'Bearer tok' },
    });

    ws.sent.length = 0;
    ws.open();

    expect(ws.sentFrames()).toContainEqual({
      action: 'authenticate',
      headers: { authorization: 'Bearer tok' },
    });
    expect(
      ws
        .sentFrames()
        .some((frame) => (frame.headers as Record<string, unknown>)?.['x-spoof-user-email']),
    ).toBe(false);
  });

  it('defers onReconnect until replayed subscriptions are acked', () => {
    let reconnected = 0;
    const api = createClient('ws://x', () => {
      reconnected++;
    });
    api.connect();
    const ws = instances[0] as FakeBrowserWebSocket;
    ws.open();

    api.subscribe('ch1');
    ws.sent.length = 0;
    ws.open();

    expect(reconnected).toBe(0);
    ws.receive({ type: 'subscribed', channel: 'ch1' });
    expect(reconnected).toBe(1);
  });

  it('re-sends a subscribe the server dropped for load', async () => {
    const api = createClient('ws://x', undefined, fastTiming);
    api.connect();
    const ws = instances[0] as FakeBrowserWebSocket;
    ws.open();
    api.subscribe('ch1');
    ws.sent.length = 0;

    ws.receive({
      type: 'error',
      action: 'subscribe',
      channel: 'ch1',
      retryable: true,
    } satisfies WSFrameErrorFrame);
    await waitFor(() => ws.sent.length > 0);

    expect(ws.sentFrames()).toEqual([{ action: 'subscribe', channel: 'ch1' }]);
  });

  it('re-sends an identity frame the server dropped for load, then replays grants under it', async () => {
    const api = createClient('ws://x', undefined, fastTiming);
    api.connect();
    const ws = instances[0] as FakeBrowserWebSocket;
    ws.open();
    api.subscribe('ch1');
    api.authenticate('tok');
    ws.sent.length = 0;

    ws.receive({
      type: 'error',
      action: 'authenticate',
      retryable: true,
    } satisfies WSFrameErrorFrame);
    await waitFor(() => ws.sentFrames().some((frame) => frame.action === 'subscribe'));

    expect(ws.sentFrames()[0]).toEqual({
      action: 'authenticate',
      headers: { authorization: 'Bearer tok' },
    });
    expect(ws.sentFrames()).toContainEqual({ action: 'subscribe', channel: 'ch1' });
  });

  it('leaves no frame-error retry pending after disconnect', () => {
    const api = createClient('ws://x', undefined, fastTiming);
    api.connect();
    const ws = instances[0] as FakeBrowserWebSocket;
    ws.open();
    api.subscribe('ch1');

    const timers = recordTimers();
    try {
      for (const frame of [
        { action: 'authenticate' },
        { action: 'subscribe', channel: 'ch1' },
        { action: 'unsubscribe', channel: 'ch2' },
        { action: 'close', stream: 'gone' },
      ])
        ws.receive({ type: 'error', retryable: true, ...frame });
      expect(timers.pending.size).toBe(4);

      api.disconnect();
      expect(timers.pending.size).toBe(0);
    } finally {
      timers.restore();
    }
  });

  it('does not report a reconnect when the socket closes before the replayed subscriptions are acked', async () => {
    let reconnected = 0;
    const api = createClient(
      'ws://x',
      () => {
        reconnected++;
      },
      { reconnectAckTimeoutMs: 5 },
    );
    api.connect();
    const ws = instances[0] as FakeBrowserWebSocket;
    ws.open();
    api.subscribe('ch1');
    ws.open();

    ws.close();
    await wait(20);

    expect(reconnected).toBe(0);
  });

  describe('data streams', () => {
    const stream = 'organizationReadManyContacts:id:org-1';
    let client: QueryClient;
    beforeEach(() => {
      client = new QueryClient();
      queryClient = client;
    });

    const connected = (timing: Partial<ApiWebsocketTiming> = fastTiming) => {
      const api = createClient('ws://x', undefined, timing);
      api.connect();
      const ws = instances[0] as FakeBrowserWebSocket;
      ws.open();
      return { api, ws };
    };

    const observe = () =>
      new QueryObserver(client, {
        queryKey: dataStreamQueryKey(stream),
        queryFn: skipToken,
      }).subscribe(() => {});

    const snapshotFrame = {
      category: 'data',
      action: 'snapshot',
      stream,
      seq: 1,
      payload: { data: [] },
    };

    it('opens once per stream across holders and closes when the last holder releases it', async () => {
      const { api, ws } = connected();
      api.open(stream);
      api.open(stream);
      api.close(stream);
      await waitForOpensSent(ws, 1);
      expect(opensOf(ws)).toEqual([{ action: 'open', stream }]);
      expect(ws.sentFrames().some((frame) => frame.action === 'close')).toBe(false);

      api.close(stream);
      await waitFor(() => ws.sentFrames().at(-1)?.action === 'close');
      expect(ws.sentFrames().at(-1)).toEqual({ action: 'close', stream });
    });

    it('sends nothing for streams opened and released within the settle window', async () => {
      const { api, ws } = connected({ ...fastTiming, streamSettleMs: 20 });
      const names = Array.from(
        { length: 130 },
        (_, i) => `organizationReadManyContacts:id:org-${i}`,
      );
      for (const name of names) {
        api.open(name);
        api.close(name);
      }
      await wait(30);

      expect(
        ws.sentFrames().filter((frame) => frame.action === 'open' || frame.action === 'close'),
      ).toEqual([]);
    });

    it('re-opens a stream re-held inside the settle window after the server rejected its open', async () => {
      const { api, ws } = connected({ ...fastTiming, streamSettleMs: 20 });
      api.open(stream);
      await waitForOpensSent(ws, 1);
      api.close(stream);
      ws.receive({ type: 'openRejected', stream } satisfies WSStreamAckFrame);
      api.open(stream);
      await waitForOpensSent(ws, 2);
    });

    it('re-opens a stream re-held inside the settle window after a retryable open error', async () => {
      const { api, ws } = connected({ ...fastTiming, streamSettleMs: 20 });
      api.open(stream);
      await waitForOpensSent(ws, 1);
      api.close(stream);
      ws.receive({
        type: 'error',
        action: 'open',
        stream,
        retryable: true,
      } satisfies WSFrameErrorFrame);
      api.open(stream);
      await waitForOpensSent(ws, 2);
    });

    it('keeps a pending retry through a release and re-hold inside the settle window', async () => {
      const { api, ws } = connected({
        ...fastTiming,
        streamSettleMs: 5,
        retryBaseMs: 40,
        retryMaxMs: 40,
        openAckTimeoutMs: 10_000,
      });
      api.open(stream);
      await waitForOpensSent(ws, 1);
      ws.receive({ type: 'opened', stream });
      ws.receive({
        type: 'error',
        action: 'open',
        stream,
        retryable: true,
      } satisfies WSFrameErrorFrame);
      api.close(stream);
      api.open(stream);
      await waitForOpensSent(ws, 2);
      await wait(60);

      expect(opensOf(ws)).toHaveLength(2);
    });

    it('re-opens after an ack timeout even when the stream is re-held during the retry backoff', async () => {
      const { api, ws } = connected({
        ...fastTiming,
        streamSettleMs: 5,
        openAckTimeoutMs: 20,
        retryBaseMs: 40,
        retryMaxMs: 40,
      });
      const unobserve = observe();
      api.open(stream);
      await waitFor(() => client.getQueryState(dataStreamQueryKey(stream))?.status === 'error');
      api.close(stream);
      api.open(stream);
      await waitFor(() => opensOf(ws).length >= 2);
      unobserve();
    });

    it('keeps a stream open across a release and re-hold within the settle window', async () => {
      const { api, ws } = connected({ ...fastTiming, streamSettleMs: 20 });
      api.open(stream);
      await waitForOpensSent(ws, 1);
      ws.receive({ type: 'opened', stream });
      api.close(stream);
      api.open(stream);
      ws.receive(snapshotFrame);
      await wait(30);

      expect(opensOf(ws)).toHaveLength(1);
      expect(ws.sentFrames().some((frame) => frame.action === 'close')).toBe(false);
      expect(client.getQueryData<unknown>(dataStreamQueryKey(stream))).toEqual({ data: [] });
    });

    it('re-opens held streams after identity on reconnect, for a fresh snapshot', () => {
      const { api, ws } = connected();
      api.authenticate('tok');
      api.open(stream);
      ws.sent.length = 0;
      ws.open();

      expect(ws.sentFrames()).toEqual([
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
      ws.open();

      expect(ws.sentFrames().map((frame) => frame.action)).toEqual([
        'authenticate',
        'subscribe',
        'open',
      ]);
    });

    it('re-opens held streams on an identity change so they are re-authorized', () => {
      const { api, ws } = connected();
      api.open(stream);
      ws.sent.length = 0;
      api.logout();

      expect(ws.sentFrames()).toEqual([{ action: 'logout' }, { action: 'open', stream }]);
    });

    it('drops a rejected stream from replay and wipes its data', async () => {
      const unobserve = observe();
      const { api, ws } = connected();
      api.open(stream);
      await waitForOpensSent(ws, 1);
      ws.receive({ type: 'opened', stream } satisfies WSStreamAckFrame);
      ws.receive(snapshotFrame);

      ws.receive({ type: 'openRejected', stream } satisfies WSStreamAckFrame);
      const state = client.getQueryState(dataStreamQueryKey(stream));
      expect(state?.status).toBe('error');
      expect(state?.data).toBeUndefined();

      ws.sent.length = 0;
      ws.open();
      expect(opensOf(ws)).toEqual([]);
      unobserve();
    });

    it('ignores data frames for a stream it no longer holds', () => {
      const { api, ws } = connected();
      api.open(stream);
      api.close(stream);

      ws.receive(snapshotFrame);

      expect(client.getQueryData<unknown>(dataStreamQueryKey(stream))).toBeUndefined();
    });

    it('routes a data frame by category, even when its action type collides with a control frame', () => {
      const { api, ws } = connected();
      api.open(stream);
      ws.receive({ type: 'opened', stream });
      ws.receive({
        category: 'data',
        action: 'append',
        stream,
        type: 'openRejected',
        payload: {},
      });

      ws.sent.length = 0;
      ws.open();
      expect(opensOf(ws)).toEqual([{ action: 'open', stream }]);
    });

    it('routes a held stream snapshot into its query', async () => {
      const { api, ws } = connected();
      api.open(stream);
      await waitForOpensSent(ws, 1);

      ws.receive(snapshotFrame);

      expect(client.getQueryData<unknown>(dataStreamQueryKey(stream))).toEqual({ data: [] });
    });

    it('never sends an open ahead of the identity frame on a connection that is not yet open', () => {
      const api = createClient('ws://x', undefined, fastTiming);
      api.connect();
      const ws = instances[0] as FakeBrowserWebSocket;
      api.authenticate('tok');
      api.open(stream);
      ws.open();

      const actions = ws.sentFrames().map((frame) => frame.action);
      expect(actions.filter((action) => action === 'open')).toHaveLength(1);
      expect(actions.indexOf('authenticate')).toBeLessThan(actions.indexOf('open'));
    });

    it('ignores a rejection answering an open that a later open superseded', async () => {
      const unobserve = observe();
      const { api, ws } = connected();
      api.open(stream);
      await waitForOpensSent(ws, 1);
      api.authenticate('tok');

      ws.receive({ type: 'openRejected', stream });
      ws.receive({ type: 'opened', stream });
      ws.receive(snapshotFrame);

      expect(client.getQueryState(dataStreamQueryKey(stream))?.status).toBe('success');
      unobserve();
    });

    it('keeps its holder count across a rejection, and a new holder retries the open', async () => {
      const { api, ws } = connected();
      api.open(stream);
      api.open(stream);
      await waitForOpensSent(ws, 1);
      ws.receive({ type: 'openRejected', stream });

      api.open(stream);
      api.close(stream);
      await waitForOpensSent(ws, 2);
      await wait(10);

      expect(opensOf(ws)).toHaveLength(2);
      expect(ws.sentFrames().some((frame) => frame.action === 'close')).toBe(false);
    });

    it('retries a retryable open error with backoff on the same connection, keeping the last snapshot', async () => {
      const unobserve = observe();
      const { api, ws } = connected();
      api.open(stream);
      await waitForOpensSent(ws, 1);
      ws.receive({ type: 'opened', stream });
      ws.receive(snapshotFrame);
      ws.sent.length = 0;

      ws.receive({
        type: 'error',
        action: 'open',
        stream,
        retryable: true,
      } satisfies WSFrameErrorFrame);
      const state = client.getQueryState(dataStreamQueryKey(stream));
      expect(state?.status).toBe('error');
      expect(state?.data).toEqual({ data: [] });

      await waitForOpensSent(ws, 1);
      expect(opensOf(ws)).toEqual([{ action: 'open', stream }]);
      unobserve();
    });

    it.each([
      { jitter: 1, delays: [20, 40, 20] },
      { jitter: 0, delays: [10, 20, 10] },
    ])('doubles the retry delay on each consecutive retryable failure and resets once opened (jitter $jitter)', async ({
      jitter,
      delays,
    }) => {
      const random = spyOn(Math, 'random').mockReturnValue(jitter);
      const timers = recordTimers();
      try {
        const { api, ws } = connected({
          ...fastTiming,
          retryBaseMs: 20,
          retryMaxMs: 1_000,
          openAckTimeoutMs: 10_000,
        });
        api.open(stream);
        await waitForOpensSent(ws, 1);
        const fail = () => ws.receive({ type: 'error', action: 'open', stream, retryable: true });

        fail();
        await waitForOpensSent(ws, 2);
        fail();
        await waitForOpensSent(ws, 3);
        ws.receive({ type: 'opened', stream });
        fail();
        await waitForOpensSent(ws, 4);

        expect(timers.delays.filter((ms) => ms >= 10 && ms <= 1_000)).toEqual([...delays]);
      } finally {
        timers.restore();
        random.mockRestore();
      }
    });

    it('treats an unanswered open as failed after the ack timeout and retries it', async () => {
      const unobserve = observe();
      const { api, ws } = connected({ ...fastTiming, openAckTimeoutMs: 30 });
      api.open(stream);

      await waitFor(() => client.getQueryState(dataStreamQueryKey(stream))?.status === 'error');
      await waitFor(() => opensOf(ws).length >= 2);
      unobserve();
    });

    it('closes a stream the server stops authorizing mid-stream', async () => {
      const unobserve = observe();
      const { api, ws } = connected();
      api.open(stream);
      await waitForOpensSent(ws, 1);
      ws.receive({ type: 'opened', stream });
      ws.receive(snapshotFrame);

      ws.receive({ type: 'openRejected', stream });

      expect(client.getQueryState(dataStreamQueryKey(stream))?.data).toBeUndefined();
      ws.receive(snapshotFrame);
      expect(client.getQueryState(dataStreamQueryKey(stream))?.data).toBeUndefined();
      unobserve();
    });

    it('replays identity, then subscribes, then opens on reconnect', () => {
      const { api, ws } = connected();
      const names = Array.from({ length: 3 }, (_, i) => `organizationReadManyContacts:id:org-${i}`);
      for (const name of names) api.open(name);
      for (let i = 0; i < 3; i++) api.subscribe(`ch${i}`);
      ws.sent.length = 0;
      ws.open();

      expect(ws.sentFrames().filter((frame) => frame.action === 'subscribe')).toHaveLength(3);
      expect(opensOf(ws)).toHaveLength(3);
      const actions = ws.sentFrames().map((frame) => frame.action);
      expect(actions.indexOf('open')).toBeGreaterThan(actions.lastIndexOf('subscribe'));
    });

    it('resync re-opens a live stream once, and never a rejected one', async () => {
      const { api, ws } = connected();
      api.open(stream);
      await waitForOpensSent(ws, 1);
      ws.receive({ type: 'opened', stream });
      ws.sent.length = 0;

      api.resync(stream);
      api.resync(stream);
      expect(opensOf(ws)).toEqual([{ action: 'open', stream }]);

      ws.receive({ type: 'openRejected', stream });
      ws.sent.length = 0;
      api.resync(stream);
      expect(opensOf(ws)).toEqual([]);
    });

    describe('sequence numbers', () => {
      const row = (id: string, version = 1) => ({
        id,
        updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, version)).toISOString(),
      });
      const snapshot = (seq: number, ids: string[]) => ({
        category: 'data',
        action: 'snapshot',
        stream,
        seq,
        payload: { data: ids.map((id) => row(id)) },
      });
      const upsert = (seq: number, id: string) => ({
        category: 'data',
        action: 'append',
        stream,
        seq,
        type: 'upsert',
        payload: row(id),
      });
      const remove = (seq: number, id: string) => ({
        category: 'data',
        action: 'append',
        stream,
        seq,
        type: 'remove',
        payload: { id },
      });
      const ids = () =>
        client
          .getQueryData<{ data: Array<{ id: string }> }>(dataStreamQueryKey(stream))
          ?.data.map(({ id }) => id);

      let consoleError: ReturnType<typeof spyOn>;
      beforeEach(() => {
        consoleError = spyOn(console, 'error').mockImplementation(() => {});
      });
      afterEach(() => consoleError.mockRestore());

      const opened = async () => {
        const { api, ws } = connected();
        api.open(stream);
        await waitForOpensSent(ws, 1);
        ws.receive({ type: 'opened', stream });
        ws.sent.length = 0;
        return { api, ws };
      };

      it('applies the next seq and ignores an append the snapshot already holds', async () => {
        const { ws } = await opened();
        ws.receive(snapshot(10, ['a']));

        ws.receive(upsert(9, 'held-before-snapshot'));
        ws.receive(upsert(10, 'held-at-snapshot'));
        ws.receive(upsert(11, 'b'));
        ws.receive(upsert(11, 'b-duplicate'));

        expect(ids()).toEqual(['b', 'a']);
        expect(opensOf(ws)).toEqual([]);
      });

      it('a dropped append makes the client resync, and the new snapshot converges', async () => {
        const { ws } = await opened();
        ws.receive(snapshot(10, ['a']));
        ws.receive(upsert(11, 'b'));

        ws.receive(remove(13, 'a'));

        expect(opensOf(ws)).toEqual([{ action: 'open', stream }]);
        expect(ids()).toEqual(['b', 'a']);

        ws.receive({ type: 'opened', stream });
        ws.receive(snapshot(13, ['c', 'b']));
        ws.receive(upsert(14, 'd'));

        expect(ids()).toEqual(['d', 'c', 'b']);
      });

      it('ignores appends between a gap and the resync snapshot, and stale ones after it', async () => {
        const { ws } = await opened();
        ws.receive(snapshot(10, ['a']));
        ws.receive(upsert(12, 'gap'));

        ws.receive(upsert(13, 'before-resync-snapshot'));
        ws.receive({ type: 'opened', stream });
        ws.receive(snapshot(14, ['x', 'a']));
        ws.receive(upsert(14, 'stale-after-resync'));
        ws.receive(upsert(13, 'older-still'));

        expect(ids()).toEqual(['x', 'a']);
        expect(opensOf(ws)).toEqual([{ action: 'open', stream }]);

        ws.receive(upsert(15, 'y'));
        expect(ids()).toEqual(['y', 'x', 'a']);
      });

      it('a gap while an open is already in flight waits for that open instead of sending another', async () => {
        const { api, ws } = await opened();
        ws.receive(snapshot(10, ['a']));
        api.authenticate('tok');
        expect(opensOf(ws)).toHaveLength(1);

        ws.receive(upsert(12, 'gap'));
        expect(opensOf(ws)).toHaveLength(1);
        ws.receive({ type: 'opened', stream });
        ws.receive(snapshot(12, ['gap', 'a']));
        expect(ids()).toEqual(['gap', 'a']);
      });

      it('a gap that lands while the stream is released and re-held still resyncs', async () => {
        const { api, ws } = await opened();
        ws.receive(snapshot(10, ['a']));
        api.close(stream);
        ws.receive(upsert(12, 'gap'));
        api.open(stream);
        await waitForOpensSent(ws, 1);

        expect(opensOf(ws)).toEqual([{ action: 'open', stream }]);
        ws.receive({ type: 'opened', stream });
        ws.receive(snapshot(12, ['gap', 'a']));
        ws.receive(upsert(13, 'b'));
        expect(ids()).toEqual(['gap', 'b', 'a']);
      });

      it('a server resync re-opens at once and keeps the data, without failing the stream', async () => {
        const { ws } = await opened();
        ws.receive(snapshot(10, ['a']));

        ws.receive({ type: 'resync', stream });
        ws.receive(upsert(11, 'before-resync-snapshot'));

        expect(opensOf(ws)).toEqual([{ action: 'open', stream }]);
        expect(client.getQueryState(dataStreamQueryKey(stream))?.status).toBe('success');
        expect(ids()).toEqual(['a']);

        ws.receive({ type: 'opened', stream });
        ws.receive(snapshot(20, ['b', 'a']));
        ws.receive(upsert(21, 'c'));
        expect(ids()).toEqual(['c', 'b', 'a']);
      });

      it('a server resync while an open is in flight waits for that open, whose answer still counts', async () => {
        const { api, ws } = await opened();
        ws.receive(snapshot(10, ['a']));
        api.authenticate('tok');
        expect(opensOf(ws)).toHaveLength(1);

        ws.receive({ type: 'resync', stream });
        expect(opensOf(ws)).toHaveLength(1);
        ws.receive({ type: 'opened', stream });
        ws.receive(snapshot(30, ['b', 'a']));
        expect(ids()).toEqual(['b', 'a']);
        expect(client.getQueryState(dataStreamQueryKey(stream))?.status).toBe('success');
      });

      it('after a server-side close (dropped frame), the reconnect snapshot restores state', async () => {
        const { api, ws } = await opened();
        ws.receive(snapshot(10, ['a']));
        ws.receive(upsert(11, 'b'));

        ws.close();
        api.connect();
        const reconnected = instances.at(-1) as FakeBrowserWebSocket;
        expect(reconnected).not.toBe(ws);
        reconnected.open();
        expect(opensOf(reconnected)).toEqual([{ action: 'open', stream }]);

        reconnected.receive(upsert(12, 'before-snapshot'));
        reconnected.receive({ type: 'opened', stream });
        reconnected.receive(snapshot(12, ['c', 'b', 'a']));
        reconnected.receive(remove(13, 'a'));

        expect(ids()).toEqual(['c', 'b']);
      });
    });
  });

  describe('adversarial review', () => {
    const stream = 'organizationReadManyContacts:id:org-1';
    beforeEach(() => {
      queryClient = new QueryClient();
    });

    const connected = (timing: Partial<ApiWebsocketTiming> = fastTiming) => {
      const api = createClient('ws://x', undefined, timing);
      api.connect();
      const ws = instances[0] as FakeBrowserWebSocket;
      ws.open();
      return { api, ws };
    };

    it('re-sends a close the server dropped for load while the stream stays released', async () => {
      const { api, ws } = connected();
      api.open(stream);
      await waitForOpensSent(ws, 1);
      ws.receive({ type: 'opened', stream });
      api.close(stream);
      await waitFor(() => ws.sentFrames().at(-1)?.action === 'close');
      ws.sent.length = 0;

      ws.receive({
        type: 'error',
        action: 'close',
        stream,
        retryable: true,
      } satisfies WSFrameErrorFrame);
      await waitFor(() => ws.sent.length > 0);

      expect(ws.sentFrames()).toEqual([{ action: 'close', stream }]);
    });

    it('re-sends an unsubscribe the server dropped for load', async () => {
      const { api, ws } = connected();
      api.subscribe('ch1');
      ws.receive({ type: 'subscribed', channel: 'ch1' });
      api.unsubscribe('ch1');
      ws.sent.length = 0;

      ws.receive({
        type: 'error',
        action: 'unsubscribe',
        channel: 'ch1',
        retryable: true,
      } satisfies WSFrameErrorFrame);
      await waitFor(() => ws.sent.length > 0);

      expect(ws.sentFrames()).toEqual([{ action: 'unsubscribe', channel: 'ch1' }]);
    });

    it('backs off identity re-sends after repeated load drops', async () => {
      const random = spyOn(Math, 'random').mockReturnValue(1);
      const timers = recordTimers();
      try {
        const { api, ws } = connected({ ...fastTiming, retryBaseMs: 20, retryMaxMs: 1_000 });
        api.authenticate('tok');
        const drop = () => ws.receive({ type: 'error', action: 'authenticate', retryable: true });
        const identities = () =>
          ws.sentFrames().filter((frame) => frame.action === 'authenticate').length;

        drop();
        await waitFor(() => identities() === 2);
        drop();
        await waitFor(() => identities() === 3);

        expect(timers.delays.filter((ms) => ms >= 20 && ms <= 1_000)).toEqual([20, 40]);
      } finally {
        timers.restore();
        random.mockRestore();
      }
    });
  });
});
