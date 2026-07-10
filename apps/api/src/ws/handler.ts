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
import { canSubscribe, resolveIdentity } from '#/ws/probe';
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
    token: null,
    spoofEmail: null,
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
    case 'authenticate':
    case 'spoof':
    case 'unspoof': {
      const credential = { token: msg.token, spoofEmail: msg.action === 'spoof' ? msg.email : null };
      const me = await resolveIdentity(credential);
      // A spoof /me doesn't honor (non-superadmin) is a rejection, not a silent identity keep.
      if (msg.action === 'spoof' && (!me || normalizeEmail(me.email) !== normalizeEmail(msg.email))) {
        send(ws, { type: 'spoofRejected' });
        return;
      }
      setIdentity(ws, me?.id ?? null);
      ws.data.token = me ? msg.token : null;
      ws.data.spoofEmail = me ? credential.spoofEmail : null;
      send(ws, { type: 'identity', userId: me?.id ?? null });
      return;
    }
    case 'logout': {
      setIdentity(ws, null);
      ws.data.token = null;
      ws.data.spoofEmail = null;
      send(ws, { type: 'identity', userId: null });
      return;
    }
    case 'subscribe': {
      if (!(await canSubscribe(ws.data, msg.channel))) {
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

export const websocketHandler = {
  open(ws: WSSocket) {
    addConnection(ws);
    send(ws, { type: 'connected', connectionId: ws.data.connectionId });
  },
  close(ws: WSSocket) {
    removeConnection(ws);
  },
  // Returns the dispatch promise (Bun ignores it; tests await it). Per-connection
  // serializedQueue keeps async identity actions from interleaving.
  message(ws: WSSocket, raw: string | Buffer) {
    const msg = parseFrame(raw);
    if (!msg) return;
    return ws.data.queue.run(() => dispatch(ws, msg));
  },
};
