import { LogScope, log } from '@template/shared/logger';
import type { AppEventPayload, WSSocket } from '#/ws/types';

// Primary index: connectionId → socket
const connectionsById = new Map<string, WSSocket>();

// Secondary index: userId → connectionIds (for sending to user across tabs)
const connectionsByUser = new Map<string, Set<string>>();

// Channel subscriptions: channel → connectionIds
const connectionsByChannel = new Map<string, Set<string>>();

const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes without ping = stale

export const addConnection = (ws: WSSocket): void => {
  const { connectionId, userId } = ws.data;

  connectionsById.set(connectionId, ws);

  // Index by user if authenticated
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

  // Remove from user index
  if (userId) {
    connectionsByUser.get(userId)?.delete(connectionId);
    if (connectionsByUser.get(userId)?.size === 0) {
      connectionsByUser.delete(userId);
    }
  }

  // Remove from all channel subscriptions
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

/**
 * Send message to a socket, removing it if send fails.
 * Returns true if sent successfully.
 */
const safeSend = (ws: WSSocket, message: string): boolean => {
  try {
    ws.send(message);
    return true;
  } catch {
    // Connection is dead, clean it up
    removeConnection(ws);
    return false;
  }
};

/**
 * Send an event to a specific user (all their connections, LOCAL only).
 * Use sendToUser from pubsub.ts for cross-server broadcasting.
 */
export const sendToUserLocal = (userId: string, event: AppEventPayload): void => {
  const connectionIds = connectionsByUser.get(userId);
  if (!connectionIds) return;

  const message = JSON.stringify(event);
  for (const connId of connectionIds) {
    const ws = connectionsById.get(connId);
    if (ws) safeSend(ws, message);
  }
};

/**
 * Send an event to all subscribers of a channel (LOCAL only).
 * Use sendToChannel from pubsub.ts for cross-server broadcasting.
 */
export const sendToChannelLocal = (channel: string, event: AppEventPayload): void => {
  const connectionIds = connectionsByChannel.get(channel);
  if (!connectionIds) return;

  const message = JSON.stringify(event);
  for (const connId of connectionIds) {
    const ws = connectionsById.get(connId);
    if (ws) safeSend(ws, message);
  }
};

/**
 * Broadcast an event to all connections (LOCAL only).
 * Use broadcast from pubsub.ts for cross-server broadcasting.
 */
export const broadcastLocal = (event: AppEventPayload): void => {
  const message = JSON.stringify(event);
  for (const [, ws] of connectionsById) {
    safeSend(ws, message);
  }
};

/**
 * Remove stale connections (no ping within timeout).
 * Call this periodically.
 */
export const cleanupStaleConnections = (): number => {
  const now = Date.now();
  let cleaned = 0;

  for (const [, ws] of connectionsById) {
    if (now - ws.data.lastPing > STALE_TIMEOUT_MS) {
      try {
        ws.close(1001, 'Connection stale');
      } catch {
        // Already dead
      }
      removeConnection(ws);
      cleaned++;
    }
  }

  return cleaned;
};

/**
 * Get stats about current connections.
 */
export const getConnectionStats = () => {
  return {
    connections: connectionsById.size,
    users: connectionsByUser.size,
    channels: connectionsByChannel.size,
  };
};

/**
 * Drain all WebSocket connections for graceful shutdown.
 * Sends reconnect message to clients, then closes connections.
 */
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
    } catch {
      // Ignore errors on close
    }
  }

  // Clear all tracking
  connectionsById.clear();
  connectionsByUser.clear();
  connectionsByChannel.clear();

  log.info('✅ WebSocket connections drained');
};
