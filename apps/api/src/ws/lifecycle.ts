/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses none
 */
import { byChannel, byId, byUser, clearRegistry, removeConnection } from '#/ws/registry';
import type { WSSocket } from '#/ws/types';

const STALE_TIMEOUT_MS = 5 * 60 * 1000;

export const updateLastPing = (ws: WSSocket): void => {
  ws.data.lastPing = Date.now();
};

// Closes + removes connections that haven't pinged within the window. Snapshots
// the values first (removeConnection mutates byId).
export const cleanupStaleConnections = (): number => {
  const now = Date.now();
  let cleaned = 0;
  for (const ws of [...byId.values()]) {
    if (now - ws.data.lastPing > STALE_TIMEOUT_MS) {
      if (ws.readyState === WebSocket.OPEN) ws.close(1001, 'Connection stale');
      removeConnection(ws);
      cleaned++;
    }
  }
  return cleaned;
};

export const getConnectionStats = (): { connections: number; users: number; channels: number } => ({
  connections: byId.size,
  users: byUser.size,
  channels: byChannel.size,
});

// Graceful shutdown: tell clients to reconnect, close sockets, clear the registry.
export const drainConnections = (): void => {
  const message = JSON.stringify({ type: 'reconnect', reason: 'server_shutdown' });
  for (const ws of [...byId.values()]) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      ws.close(1001, 'Server shutting down');
    }
  }
  clearRegistry();
};
