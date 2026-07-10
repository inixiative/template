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
  let everOpened = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let pongTimer: ReturnType<typeof setTimeout> | undefined;

  const socket = createWebSocketClient({
    url,
    onMessage: (data) => {
      if ((data as { type?: string })?.type === 'pong') return void clearTimeout(pongTimer);
      dispatchMessage(data as WSEvent);
    },
    onOpen: () => {
      for (const channel of channels.keys()) socket.send({ action: 'subscribe', channel });
      if (everOpened) onReconnect?.(); // re-open only: recover events missed while disconnected
      everOpened = true;
    },
  });

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
    authenticate: (token) => socket.send({ action: 'authenticate', token }),
    spoof: (token, email) => socket.send({ action: 'spoof', token, email }),
    unspoof: (token) => socket.send({ action: 'unspoof', token }),
    logout: () => socket.send({ action: 'logout' }),
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
