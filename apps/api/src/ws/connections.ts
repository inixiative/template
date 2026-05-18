// @wip — part of the ws/ rewrite (see pubsub.ts / handler.ts).
// Known TODOs: iteration-during-mutation in sendToUserLocal / sendToChannelLocal /
// cleanupStaleConnections (safeSend → removeConnection deletes from the set being
// iterated). Try/catch wrappers around ws.send/ws.close should be replaced with
// readyState guards (no try/catch).

import { log } from '@template/shared/logger';
import type { AppEventPayload, WSSocket } from '#/ws/types';

const connectionsById = new Map<string, WSSocket>();
const connectionsByUser = new Map<string, Set<string>>();
const connectionsByChannel = new Map<string, Set<string>>();

const STALE_TIMEOUT_MS = 5 * 60 * 1000;

export const addConnection = (ws: WSSocket): void => {
  const { connectionId, userId } = ws.data;

  connectionsById.set(connectionId, ws);

  if (userId) {
    if (!connectionsByUser.has(userId)) {
      connectionsByUser.set(userId, new Set());
    }
    connectionsByUser.get(userId)!.add(connectionId);
  }
};

export const removeConnection = (ws: WSSocket): void => {
  const { connectionId, userId, channels } = ws.data;

  connectionsById.delete(connectionId);

  if (userId) {
    connectionsByUser.get(userId)?.delete(connectionId);
    if (connectionsByUser.get(userId)?.size === 0) {
      connectionsByUser.delete(userId);
    }
  }

  for (const channel of channels) {
    connectionsByChannel.get(channel)?.delete(connectionId);
    if (connectionsByChannel.get(channel)?.size === 0) {
      connectionsByChannel.delete(channel);
    }
  }
};

export const subscribeToChannel = (ws: WSSocket, channel: string): void => {
  ws.data.channels.add(channel);

  if (!connectionsByChannel.has(channel)) {
    connectionsByChannel.set(channel, new Set());
  }
  connectionsByChannel.get(channel)!.add(ws.data.connectionId);
};

export const unsubscribeFromChannel = (ws: WSSocket, channel: string): void => {
  ws.data.channels.delete(channel);

  connectionsByChannel.get(channel)?.delete(ws.data.connectionId);
  if (connectionsByChannel.get(channel)?.size === 0) {
    connectionsByChannel.delete(channel);
  }
};

export const updateLastPing = (ws: WSSocket): void => {
  ws.data.lastPing = Date.now();
};

// Removes the connection on send failure.
const safeSend = (ws: WSSocket, message: string): boolean => {
  try {
    ws.send(message);
    return true;
  } catch {
    removeConnection(ws);
    return false;
  }
};

export const sendToUserLocal = (userId: string, event: AppEventPayload): void => {
  const connectionIds = connectionsByUser.get(userId);
  if (!connectionIds) return;

  const message = JSON.stringify(event);
  for (const connId of connectionIds) {
    const ws = connectionsById.get(connId);
    if (ws) safeSend(ws, message);
  }
};

export const sendToChannelLocal = (channel: string, event: AppEventPayload): void => {
  const connectionIds = connectionsByChannel.get(channel);
  if (!connectionIds) return;

  const message = JSON.stringify(event);
  for (const connId of connectionIds) {
    const ws = connectionsById.get(connId);
    if (ws) safeSend(ws, message);
  }
};

export const broadcastLocal = (event: AppEventPayload): void => {
  const message = JSON.stringify(event);
  for (const [, ws] of connectionsById) {
    safeSend(ws, message);
  }
};

export const cleanupStaleConnections = (): number => {
  const now = Date.now();
  let cleaned = 0;

  for (const [, ws] of connectionsById) {
    if (now - ws.data.lastPing > STALE_TIMEOUT_MS) {
      try {
        ws.close(1001, 'Connection stale');
      } catch {}
      removeConnection(ws);
      cleaned++;
    }
  }

  return cleaned;
};

export const getConnectionStats = () => {
  return {
    connections: connectionsById.size,
    users: connectionsByUser.size,
    channels: connectionsByChannel.size,
  };
};

// Graceful shutdown: tells clients to reconnect, then closes sockets.
export const drainConnections = async (): Promise<void> => {
  const stats = getConnectionStats();
  if (stats.connections === 0) return;

  log.info(`🔌 Draining ${stats.connections} WebSocket connections...`);

  const message = JSON.stringify({
    type: 'reconnect',
    reason: 'server_shutdown',
    timestamp: new Date().toISOString(),
  });

  for (const [, ws] of connectionsById) {
    try {
      ws.send(message);
      ws.close(1001, 'Server shutting down');
    } catch {}
  }

  connectionsById.clear();
  connectionsByUser.clear();
  connectionsByChannel.clear();

  log.info('✅ WebSocket connections drained');
};
