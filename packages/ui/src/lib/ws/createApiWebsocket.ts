/**
 * @atlas
 * @kind client
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import { createWebSocketClient, type WSEvent } from '@template/shared/ws';
import { dispatchMessage } from '@template/ui/lib/ws/dispatch';
import { failDataStream } from '@template/ui/lib/ws/failDataStream';
import { type DebouncedFunc, debounce } from 'lodash-es';

export type ApiWebsocketTiming = {
  heartbeatMs: number;
  pongTimeoutMs: number;
  reconnectAckTimeoutMs: number;
  openAckTimeoutMs: number;
  retryBaseMs: number;
  retryMaxMs: number;
  streamSettleMs: number;
};

const DEFAULT_TIMING: ApiWebsocketTiming = {
  heartbeatMs: 30_000,
  pongTimeoutMs: 5_000,
  reconnectAckTimeoutMs: 5_000,
  openAckTimeoutMs: 10_000,
  retryBaseMs: 1_000,
  retryMaxMs: 30_000,
  streamSettleMs: 100,
};

export type ApiWebsocket = {
  connect: () => void;
  authenticate: (token: string) => void;
  spoof: (token: string, email: string) => void;
  unspoof: (token: string) => void;
  logout: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  open: (stream: string) => void;
  close: (stream: string) => void;
  resync: (stream: string) => void;
};

type InboundFrame = {
  type?: string;
  action?: string;
  channel?: string;
  stream?: string;
  category?: string;
  retryable?: boolean;
};

export const createApiWebsocket = (
  url: string,
  onReconnect?: () => void,
  timingOverrides: Partial<ApiWebsocketTiming> = {},
): ApiWebsocket => {
  const timing = { ...DEFAULT_TIMING, ...timingOverrides };
  const channels = new Map<string, number>();
  const streams = new Map<string, number>();
  const rejectedStreams = new Set<string>();
  const pendingOpens = new Map<string, number>();
  const openAckTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const retryAttempts = new Map<string, number>();
  const settlers = new Map<string, DebouncedFunc<() => void>>();
  const sentOpens = new Set<string>();
  const sentSubscribes = new Set<string>();
  let identityAttempts = 0;
  let identityFrame: Record<string, unknown> | null = null;
  let everOpened = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let pongTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingAcks: Set<string> | null = null;
  let reconnectAckTimer: ReturnType<typeof setTimeout> | undefined;

  const isLive = (stream: string): boolean => streams.has(stream) && !rejectedStreams.has(stream);

  const backoffDelay = (attempt: number): number => {
    const ceiling = Math.min(timing.retryMaxMs, timing.retryBaseMs * 2 ** (attempt - 1));
    return ceiling / 2 + Math.random() * (ceiling / 2);
  };

  const sendSubscribe = (channel: string): void => {
    socket.send({ action: 'subscribe', channel });
    sentSubscribes.add(channel);
  };

  const sendRelease = (frame: Record<string, unknown>): void => {
    if (socket.status() === 'open') socket.send(frame);
  };

  const clearTimers = (timers: Map<string, ReturnType<typeof setTimeout>>, key?: string): void => {
    for (const [held, timer] of timers) {
      if (key !== undefined && held !== key) continue;
      clearTimeout(timer);
      timers.delete(held);
    }
  };

  const onOpenAckTimeout = (stream: string): void => {
    openAckTimers.delete(stream);
    if (!pendingOpens.delete(stream)) return;
    sentOpens.delete(stream);
    if (!isLive(stream)) return;
    failDataStream(stream, 'failed');
    scheduleRetry(stream);
  };

  const sendOpen = (stream: string): void => {
    if (socket.status() !== 'open') return;
    socket.send({ action: 'open', stream });
    sentOpens.add(stream);
    clearTimers(retryTimers, stream);
    pendingOpens.set(stream, (pendingOpens.get(stream) ?? 0) + 1);
    clearTimers(openAckTimers, stream);
    openAckTimers.set(
      stream,
      setTimeout(() => onOpenAckTimeout(stream), timing.openAckTimeoutMs),
    );
  };

  const scheduleRetry = (stream: string): void => {
    if (retryTimers.has(stream)) return;
    const attempt = (retryAttempts.get(stream) ?? 0) + 1;
    retryAttempts.set(stream, attempt);
    const delay = backoffDelay(attempt);
    retryTimers.set(
      stream,
      setTimeout(() => {
        retryTimers.delete(stream);
        if (isLive(stream) && !pendingOpens.has(stream)) sendOpen(stream);
      }, delay),
    );
  };

  const reconcileStream = (stream: string): void => {
    if (isLive(stream)) {
      if (!sentOpens.has(stream)) sendOpen(stream);
      return;
    }
    if (streams.has(stream)) return;
    clearTimers(retryTimers, stream);
    retryAttempts.delete(stream);
    if (sentOpens.delete(stream)) sendRelease({ action: 'close', stream });
  };

  // Holder churn inside the window nets out, so a stream opened and released in passing sends no frames.
  const settle = (stream: string): void => {
    const settler =
      settlers.get(stream) ??
      debounce(() => {
        settlers.delete(stream);
        reconcileStream(stream);
      }, timing.streamSettleMs);
    settlers.set(stream, settler);
    settler();
  };

  const isFinalOpenAnswer = (stream: string): boolean => {
    const outstanding = pendingOpens.get(stream);
    if (outstanding === undefined) return true;
    if (outstanding > 1) {
      pendingOpens.set(stream, outstanding - 1);
      return false;
    }
    pendingOpens.delete(stream);
    clearTimers(openAckTimers, stream);
    return true;
  };

  const failOpen = (stream: string, retryable: boolean): void => {
    sentOpens.delete(stream);
    if (!streams.has(stream)) return;
    if (retryable) {
      failDataStream(stream, 'failed');
      scheduleRetry(stream);
      return;
    }
    console.error(`ws stream open rejected: ${stream}`);
    rejectedStreams.add(stream);
    clearTimers(retryTimers, stream);
    failDataStream(stream, 'rejected');
  };

  const replaySubscriptions = (): void => {
    if (socket.status() !== 'open') return;
    for (const channel of channels.keys()) sendSubscribe(channel);
    for (const stream of streams.keys()) if (!rejectedStreams.has(stream)) sendOpen(stream);
  };

  const finishReconnect = (): void => {
    if (!pendingAcks) return;
    pendingAcks = null;
    clearTimeout(reconnectAckTimer);
    onReconnect?.();
  };

  const settleReconnectAck = (channel: string): void => {
    if (!pendingAcks) return;
    pendingAcks.delete(channel);
    if (pendingAcks.size === 0) finishReconnect();
  };

  const onFrameError = (frame: InboundFrame): void => {
    if (frame.action === 'authenticate' || frame.action === 'logout') {
      identityAttempts++;
      setTimeout(() => {
        if (socket.status() === 'open') sendIdentity(identityFrame);
      }, backoffDelay(identityAttempts));
      return;
    }
    const { channel, stream } = frame;
    if (frame.action === 'subscribe' && channel) {
      setTimeout(() => {
        if (channels.has(channel) && socket.status() === 'open') sendSubscribe(channel);
      }, timing.retryBaseMs);
      return;
    }
    if (frame.action === 'unsubscribe' && channel) {
      setTimeout(() => {
        if (!channels.has(channel)) sendRelease({ action: 'unsubscribe', channel });
      }, timing.retryBaseMs);
      return;
    }
    if (frame.action === 'close' && stream) {
      setTimeout(() => {
        if (!streams.has(stream)) sendRelease({ action: 'close', stream });
      }, timing.retryBaseMs);
      return;
    }
    if (frame.action !== 'open' || !frame.stream || !isFinalOpenAnswer(frame.stream)) return;
    failOpen(frame.stream, !!frame.retryable);
  };

  const onControlFrame = (frame: InboundFrame): void => {
    switch (frame.type) {
      case 'pong':
        return void clearTimeout(pongTimer);
      case 'spoofRejected':
        return void recoverFromRejectedSpoof();
      case 'subscribeRejected':
        console.error(`ws subscribe rejected: ${frame.channel}`);
        channels.delete(frame.channel as string);
        return void settleReconnectAck(frame.channel as string);
      case 'subscribed':
        return void settleReconnectAck(frame.channel as string);
      case 'unsubscribed':
      case 'closed':
        return;
      case 'identity':
        identityAttempts = 0;
        return;
      case 'opened':
        isFinalOpenAnswer(frame.stream as string);
        return void retryAttempts.delete(frame.stream as string);
      case 'openRejected':
        if (isFinalOpenAnswer(frame.stream as string)) failOpen(frame.stream as string, false);
        return;
      case 'error':
        onFrameError(frame);
        return;
    }
  };

  const socket = createWebSocketClient({
    url,
    onMessage: (data) => {
      const frame = data as InboundFrame;
      if (frame.category === 'data') {
        if (sentOpens.has(frame.stream as string)) dispatchMessage(data as WSEvent);
        return;
      }
      if (frame.category) dispatchMessage(data as WSEvent);
      else onControlFrame(frame);
    },
    onOpen: () => {
      if (identityFrame) socket.send(identityFrame);
      replaySubscriptions();
      const reconnecting = everOpened;
      everOpened = true;
      if (!reconnecting) return;
      if (channels.size === 0) return void onReconnect?.();
      clearTimeout(reconnectAckTimer);
      pendingAcks = new Set(channels.keys());
      reconnectAckTimer = setTimeout(finishReconnect, timing.reconnectAckTimeoutMs);
    },
    onClose: () => {
      clearTimeout(pongTimer);
      pendingOpens.clear();
      sentOpens.clear();
      sentSubscribes.clear();
      clearTimers(openAckTimers);
      clearTimers(retryTimers);
    },
  });

  const sendIdentity = (frame: Record<string, unknown> | null): void => {
    identityFrame = frame;
    rejectedStreams.clear();
    clearTimers(retryTimers);
    socket.send(frame ?? { action: 'logout' });
    replaySubscriptions();
  };

  const recoverFromRejectedSpoof = (): void => {
    const headers = identityFrame?.headers as Record<string, string> | undefined;
    if (!headers?.['x-spoof-user-email']) return;
    console.error('ws spoof rejected; falling back to real identity');
    sendIdentity({ action: 'authenticate', headers: { authorization: headers.authorization } });
  };

  return {
    connect: () => {
      socket.connect();
      if (heartbeat) return;
      heartbeat = setInterval(() => {
        clearTimeout(pongTimer);
        if (socket.status() !== 'open') return;
        socket.send({ action: 'ping' });
        pongTimer = setTimeout(() => socket.reconnect(), timing.pongTimeoutMs);
      }, timing.heartbeatMs);
    },
    authenticate: (token) => sendIdentity({ action: 'authenticate', headers: { authorization: `Bearer ${token}` } }),
    spoof: (token, email) =>
      sendIdentity({
        action: 'authenticate',
        headers: { authorization: `Bearer ${token}`, 'x-spoof-user-email': email },
      }),
    unspoof: (token) => sendIdentity({ action: 'authenticate', headers: { authorization: `Bearer ${token}` } }),
    logout: () => sendIdentity(null),
    subscribe: (channel) => {
      const refs = channels.get(channel) ?? 0;
      channels.set(channel, refs + 1);
      if (refs === 0 && socket.status() === 'open') sendSubscribe(channel);
    },
    unsubscribe: (channel) => {
      const refs = channels.get(channel) ?? 0;
      if (refs === 0) return;
      if (refs > 1) return void channels.set(channel, refs - 1);
      channels.delete(channel);
      if (sentSubscribes.delete(channel)) sendRelease({ action: 'unsubscribe', channel });
    },
    open: (stream) => {
      const refs = streams.get(stream) ?? 0;
      streams.set(stream, refs + 1);
      if (refs > 0 && !rejectedStreams.has(stream)) return;
      if (rejectedStreams.delete(stream)) retryAttempts.delete(stream);
      settle(stream);
    },
    close: (stream) => {
      const refs = streams.get(stream) ?? 0;
      if (refs === 0) return;
      if (refs > 1) return void streams.set(stream, refs - 1);
      streams.delete(stream);
      rejectedStreams.delete(stream);
      settle(stream);
    },
    resync: (stream) => {
      if (isLive(stream) && !pendingOpens.has(stream)) sendOpen(stream);
    },
  };
};
