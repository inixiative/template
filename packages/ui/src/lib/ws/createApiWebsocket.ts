/**
 * @atlas
 * @kind client
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import { createWebSocketClient, type WSEvent } from '@template/shared/ws';
import { dispatchMessage } from '@template/ui/lib/ws/dispatch';

const HEARTBEAT_MS = 30_000;
const PONG_TIMEOUT_MS = 5_000;
const RECONNECT_ACK_TIMEOUT_MS = 5_000;

export type ApiWebsocket = {
  connect: () => void;
  authenticate: (token: string) => void;
  spoof: (token: string, email: string) => void;
  unspoof: (token: string) => void;
  logout: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
};

export const createApiWebsocket = (url: string, onReconnect?: () => void): ApiWebsocket => {
  // The channels this socket is subscribed to, refcounted across callers. Single source of truth —
  // replayed on every (re)open since the BE forgets subscriptions when a connection drops.
  const channels = new Map<string, number>();
  // Last identity frame (authenticate/spoof/unspoof; null after logout) — a (re)opened connection
  // starts anonymous on the BE, so identity must be replayed before anything identity-dependent.
  let identityFrame: Record<string, unknown> | null = null;
  let everOpened = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let pongTimer: ReturnType<typeof setTimeout> | undefined;
  // Replayed subscribes still awaiting ack after a reconnect; onReconnect waits for this to drain so a refetch can't outrun the regrant.
  let pendingAcks: Set<string> | null = null;
  let reconnectAckTimer: ReturnType<typeof setTimeout> | undefined;

  const replaySubscriptions = (): void => {
    for (const channel of channels.keys()) socket.send({ action: 'subscribe', channel });
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

  const socket = createWebSocketClient({
    url,
    onMessage: (data) => {
      const frame = data as { type?: string; channel?: string };
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
      }
      dispatchMessage(data as WSEvent);
    },
    onOpen: () => {
      // Identity first — the BE processes each connection's frames in order.
      if (identityFrame) socket.send(identityFrame);
      replaySubscriptions();
      const reconnecting = everOpened;
      everOpened = true;
      if (!reconnecting) return;
      // Re-open only: recover missed events, but wait for the regranted subscriptions to ack (or timeout) first.
      if (channels.size === 0) return void onReconnect?.();
      clearTimeout(reconnectAckTimer);
      pendingAcks = new Set(channels.keys());
      reconnectAckTimer = setTimeout(finishReconnect, RECONNECT_ACK_TIMEOUT_MS);
    },
    // A pong pending from the previous connection must not tear down the next one.
    onClose: () => clearTimeout(pongTimer),
  });

  // Any identity change drops every grant on the BE — resubscribe, re-authorized as the new one.
  const sendIdentity = (frame: Record<string, unknown> | null): void => {
    identityFrame = frame;
    socket.send(frame ?? { action: 'logout' });
    replaySubscriptions();
  };

  // A refused spoof would replay every reconnect and stay anonymous; drop it and re-auth as the real identity.
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
      // Bidirectional heartbeat: ping, expect a pong within PONG_TIMEOUT_MS; otherwise the
      // connection is dead (half-open) — drop it and let auto-reconnect + replay recover.
      heartbeat = setInterval(() => {
        clearTimeout(pongTimer);
        if (socket.status() !== 'open') return;
        socket.send({ action: 'ping' });
        pongTimer = setTimeout(() => socket.reconnect(), PONG_TIMEOUT_MS);
      }, HEARTBEAT_MS);
    },
    // Credentials ride as the same headers an HTTP request carries; spoofing is just a header.
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
      if (refs === 0) socket.send({ action: 'subscribe', channel });
    },
    unsubscribe: (channel) => {
      const refs = channels.get(channel) ?? 0;
      if (refs === 0) return;
      if (refs === 1) {
        channels.delete(channel);
        socket.send({ action: 'unsubscribe', channel });
      } else {
        channels.set(channel, refs - 1);
      }
    },
  };
};
