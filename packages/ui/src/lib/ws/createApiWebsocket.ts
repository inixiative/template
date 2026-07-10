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
  // Last identity frame (authenticate/spoof/unspoof; null after logout) — a (re)opened connection
  // starts anonymous on the BE, so identity must be replayed before anything identity-dependent.
  let identityFrame: Record<string, unknown> | null = null;
  let everOpened = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let pongTimer: ReturnType<typeof setTimeout> | undefined;

  const replaySubscriptions = (): void => {
    for (const channel of channels.keys()) socket.send({ action: 'subscribe', channel });
  };

  const socket = createWebSocketClient({
    url,
    onMessage: (data) => {
      if ((data as { type?: string })?.type === 'pong') return void clearTimeout(pongTimer);
      dispatchMessage(data as WSEvent);
    },
    onOpen: () => {
      // Identity first — the BE processes each connection's frames in order.
      if (identityFrame) socket.send(identityFrame);
      replaySubscriptions();
      if (everOpened) onReconnect?.(); // re-open only: recover events missed while disconnected
      everOpened = true;
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
    authenticate: (token) => sendIdentity({ action: 'authenticate', token }),
    spoof: (token, email) => sendIdentity({ action: 'spoof', token, email }),
    unspoof: (token) => sendIdentity({ action: 'unspoof', token }),
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
