/**
 * @atlas
 * @kind entrypoint
 * @partOf primitive:websockets
 * @uses none
 */
import { LogScope, log } from '@template/shared/logger';
import { createSerializedQueue } from '@template/shared/utils';
import { WS_MAX_PENDING_FRAMES } from '@template/shared/ws';
import type { Server } from 'bun';
import { makeUnrefInterval } from '#/lib/utils/makeUnrefInterval';
import { normalizeEmail } from '#/modules/user/utils/normalizeEmail';
import { closeDataStream, openDataStream } from '#/ws/dataStreams';
import { sendTo } from '#/ws/delivery';
import { frameError } from '#/ws/frameError';
import { overFrameLimit } from '#/ws/frameRateLimit';
import { setIdentity } from '#/ws/identity';
import { cleanupStaleConnections, updateLastPing } from '#/ws/lifecycle';
import { canSubscribe, resolveIdentity, sanitizeWSHeaders } from '#/ws/probe';
import { addConnection, byId, removeConnection } from '#/ws/registry';
import { subscribeToChannel, unsubscribeFromChannel } from '#/ws/subscriptions';
import type { StreamFrame, WSData, WSMessage, WSSocket } from '#/ws/types';

type WSServer = Server<WSData>;

const staleSweep = makeUnrefInterval({
  intervalMs: 60_000,
  tick: () => {
    const cleaned = cleanupStaleConnections();
    if (cleaned > 0) log.info(`Cleaned up ${cleaned} stale WebSocket connections`, LogScope.ws);
  },
});
export const startStaleSweep = staleSweep.start;
export const stopStaleSweep = staleSweep.stop;

export const acceptWebSocket = (req: Request, server: WSServer): Response | undefined => {
  const now = Date.now();
  const data: WSData = {
    connectionId: crypto.randomUUID(),
    userId: null,
    headers: {},
    channels: new Set(),
    streams: new Set(),
    heldAppends: new Map(),
    latestStreamFrames: new Map(),
    connectedAt: now,
    lastPing: now,
    queue: createSerializedQueue(),
  };
  return server.upgrade(req, { data })
    ? undefined
    : new Response('Upgrade failed', { status: 426 });
};

const parseFrame = (raw: string | Buffer): WSMessage | null => {
  try {
    const parsed: unknown = JSON.parse(raw.toString());
    if (typeof parsed !== 'object' || parsed === null) return null;
    return typeof (parsed as { action?: unknown }).action === 'string'
      ? (parsed as WSMessage)
      : null;
  } catch {
    return null;
  }
};

const isStreamFrame = (msg: WSMessage): msg is StreamFrame =>
  msg.action === 'open' || msg.action === 'close';

// An open a later open or close of the same stream superseded while queued skips its snapshot read;
// it is still answered, since the client counts one answer per open it sent.
const takeLatestStreamFrame = (ws: WSSocket, msg: StreamFrame): boolean => {
  if (ws.data.latestStreamFrames.get(msg.stream) !== msg) return false;
  ws.data.latestStreamFrames.delete(msg.stream);
  return true;
};

const dispatch = async (ws: WSSocket, msg: WSMessage): Promise<void> => {
  switch (msg.action) {
    case 'authenticate': {
      const headers = sanitizeWSHeaders(msg.headers);
      const identity = await resolveIdentity(headers);
      if (!byId.has(ws.data.connectionId)) return;
      if (identity.status === 'retryable') {
        sendTo(ws, frameError(msg));
        return;
      }
      const actor = identity.status === 'resolved' ? identity : null;
      // A spoof header /identify doesn't honor (non-superadmin) is a rejection, not a silent keep.
      const spoofEmail = headers['x-spoof-user-email'];
      if (
        spoofEmail &&
        (!actor?.email || normalizeEmail(actor.email) !== normalizeEmail(spoofEmail))
      ) {
        sendTo(ws, { type: 'spoofRejected' });
        return;
      }
      setIdentity(ws, actor?.userId ?? null, actor ? headers : {});
      sendTo(ws, { type: 'identity', userId: actor?.userId ?? null });
      return;
    }
    case 'logout': {
      setIdentity(ws, null, {});
      sendTo(ws, { type: 'identity', userId: null });
      return;
    }
    case 'subscribe': {
      const granted = await canSubscribe(ws.data.headers, msg.channel);
      if (!byId.has(ws.data.connectionId)) return;
      if (!granted) {
        sendTo(ws, { type: 'subscribeRejected', channel: msg.channel });
        return;
      }
      subscribeToChannel(ws, msg.channel);
      sendTo(ws, { type: 'subscribed', channel: msg.channel });
      return;
    }
    case 'unsubscribe': {
      unsubscribeFromChannel(ws, msg.channel);
      sendTo(ws, { type: 'unsubscribed', channel: msg.channel });
      return;
    }
    case 'open': {
      if (!takeLatestStreamFrame(ws, msg)) {
        sendTo(ws, { type: 'opened', stream: msg.stream });
        return;
      }
      await openDataStream(ws, msg.stream);
      return;
    }
    case 'close': {
      takeLatestStreamFrame(ws, msg);
      closeDataStream(ws, msg.stream);
      return;
    }
  }
};

export const websocketHandler = {
  open(ws: WSSocket) {
    addConnection(ws);
    sendTo(ws, { type: 'connected', connectionId: ws.data.connectionId });
  },
  close(ws: WSSocket) {
    removeConnection(ws);
  },
  // Returns the dispatch promise: Bun ignores it, tests await it.
  message(ws: WSSocket, raw: string | Buffer) {
    if (overFrameLimit(ws)) {
      ws.close(1008, 'rate limit exceeded');
      return;
    }
    const msg = parseFrame(raw);
    if (!msg) return;
    // Liveness must not wait behind queued snapshot reads or the re-authorization sweep.
    if (msg.action === 'ping') {
      updateLastPing(ws);
      sendTo(ws, { type: 'pong' });
      return;
    }
    if (ws.data.queue.size() >= WS_MAX_PENDING_FRAMES) {
      sendTo(ws, frameError(msg));
      return;
    }
    if (isStreamFrame(msg)) ws.data.latestStreamFrames.set(msg.stream, msg);
    return ws.data.queue
      .run(() => dispatch(ws, msg))
      .catch((err) => {
        log.error(
          `ws dispatch failed (${msg.action}): ${err instanceof Error ? err.message : String(err)}`,
          LogScope.ws,
        );
        sendTo(ws, frameError(msg));
      });
  },
};
