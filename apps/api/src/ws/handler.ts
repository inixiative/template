/**
 * @atlas
 * @kind entrypoint
 * @partOf primitive:websockets
 * @uses none
 */
import { LogScope, log } from '@template/shared/logger';
import { createSerializedQueue } from '@template/shared/utils';
import type { Server } from 'bun';
import { normalizeEmail } from '#/modules/user/utils/normalizeEmail';
import { setIdentity } from '#/ws/identity';
import { cleanupStaleConnections, updateLastPing } from '#/ws/lifecycle';
import { canSubscribe, resolveIdentity, sanitizeWSHeaders } from '#/ws/probe';
import { addConnection, removeConnection } from '#/ws/registry';
import { subscribeToChannel, unsubscribeFromChannel } from '#/ws/subscriptions';
import type { WSData, WSMessage, WSSocket } from '#/ws/types';

type WSServer = Server<WSData>;

// Periodic stale-connection sweep. Started explicitly from server startup (not a
// module-load side effect, so importing the handler in tests doesn't spin a timer).
let staleSweep: ReturnType<typeof setInterval> | null = null;
export const startStaleSweep = (): void => {
  if (staleSweep) return;
  staleSweep = setInterval(() => {
    const cleaned = cleanupStaleConnections();
    if (cleaned > 0) log.info(`Cleaned up ${cleaned} stale WebSocket connections`, LogScope.ws);
  }, 60_000);
};

// Promote an HTTP request to a WebSocket. Anonymous by default — identity is set
// later by the authenticate message, never at the handshake. server.upgrade
// returns true when Bun took over the connection (return undefined); false means
// we must return a Response ourselves.
export const acceptWebSocket = (req: Request, server: WSServer): Response | undefined => {
  const now = Date.now();
  const data: WSData = {
    connectionId: crypto.randomUUID(),
    userId: null,
    headers: {},
    channels: new Set(),
    connectedAt: now,
    lastPing: now,
    queue: createSerializedQueue(),
  };
  return server.upgrade(req, { data }) ? undefined : new Response('Upgrade failed', { status: 426 });
};

const send = (ws: WSSocket, payload: Record<string, unknown>): void => {
  ws.send(JSON.stringify(payload));
};

// Parse an untrusted client frame. Malformed JSON → null (dropped). This is the
// one network-boundary parse that legitimately guards against a throw; the caller
// then guards on null.
const parseFrame = (raw: string | Buffer): WSMessage | null => {
  try {
    return JSON.parse(raw.toString()) as WSMessage;
  } catch {
    return null;
  }
};

const dispatch = async (ws: WSSocket, msg: WSMessage): Promise<void> => {
  switch (msg.action) {
    case 'authenticate': {
      const headers = sanitizeWSHeaders(msg.headers);
      const me = await resolveIdentity(headers);
      // A spoof header /me doesn't honor (non-superadmin) is a rejection, not a silent keep.
      const spoofEmail = headers['x-spoof-user-email'];
      if (spoofEmail && (!me || normalizeEmail(me.email) !== normalizeEmail(spoofEmail))) {
        send(ws, { type: 'spoofRejected' });
        return;
      }
      setIdentity(ws, me?.id ?? null);
      ws.data.headers = me ? headers : {};
      send(ws, { type: 'identity', userId: me?.id ?? null });
      return;
    }
    case 'logout': {
      setIdentity(ws, null);
      ws.data.headers = {};
      send(ws, { type: 'identity', userId: null });
      return;
    }
    case 'subscribe': {
      if (!(await canSubscribe(ws.data.headers, msg.channel))) {
        send(ws, { type: 'subscribeRejected', channel: msg.channel });
        return;
      }
      subscribeToChannel(ws, msg.channel);
      send(ws, { type: 'subscribed', channel: msg.channel });
      return;
    }
    case 'unsubscribe': {
      unsubscribeFromChannel(ws, msg.channel);
      send(ws, { type: 'unsubscribed', channel: msg.channel });
      return;
    }
    case 'ping': {
      updateLastPing(ws);
      send(ws, { type: 'pong' });
      return;
    }
  }
};

// Backpressure: a socket flooding frames grows the per-connection queue without bound (each
// dispatch awaits I/O). Cap pending dispatches and overall frame rate; abusers are closed.
const MAX_PENDING_FRAMES = 32;
const FRAME_LIMIT = 120;
const FRAME_WINDOW_MS = 10_000;
const frameWindows = new WeakMap<WSSocket, { start: number; count: number }>();

const overFrameLimit = (ws: WSSocket): boolean => {
  const now = Date.now();
  const window = frameWindows.get(ws);
  if (!window || now - window.start > FRAME_WINDOW_MS) {
    frameWindows.set(ws, { start: now, count: 1 });
    return false;
  }
  window.count++;
  return window.count > FRAME_LIMIT;
};

export const websocketHandler = {
  open(ws: WSSocket) {
    addConnection(ws);
    send(ws, { type: 'connected', connectionId: ws.data.connectionId });
  },
  close(ws: WSSocket) {
    removeConnection(ws);
  },
  // Returns the dispatch promise (Bun ignores it; tests await it). Per-connection
  // serializedQueue keeps async identity actions from interleaving; the catch is the ws
  // error boundary — a failed dispatch stays scoped to its connection.
  message(ws: WSSocket, raw: string | Buffer) {
    if (overFrameLimit(ws)) {
      ws.close(1008, 'rate limit exceeded');
      return;
    }
    if (ws.data.queue.size() >= MAX_PENDING_FRAMES) return;
    const msg = parseFrame(raw);
    if (!msg) return;
    return ws.data.queue.run(() => dispatch(ws, msg)).catch((err) => {
      log.error(`ws dispatch failed (${msg.action}): ${err instanceof Error ? err.message : String(err)}`, LogScope.ws);
      send(ws, { type: 'error', action: msg.action });
    });
  },
};
