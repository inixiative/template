import type { Server } from 'bun';
import { log } from '#/lib/logger';
import type { WSData, WSMessage, WSSocket } from '#/ws/types';

type WSServer = Server;
import { authenticateWS } from '#/ws/auth';
import {
  addConnection,
  cleanupStaleConnections,
  removeConnection,
  subscribeToChannel,
  unsubscribeFromChannel,
  updateLastPing,
} from '#/ws/connections';

// Run stale cleanup every minute
setInterval(() => {
  const cleaned = cleanupStaleConnections();
  if (cleaned > 0) {
    log.info(`🧹 Cleaned up ${cleaned} stale WebSocket connections`);
  }
}, 60_000);

/**
 * Handle WebSocket upgrade requests.
 * Allows anonymous connections (userId will be null).
 */
export async function handleUpgrade(req: Request, server: WSServer): Promise<Response | undefined> {
  const { connectionId, userId } = await authenticateWS(req);

  const now = Date.now();
  const data: WSData = {
    connectionId,
    userId,
    channels: new Set(),
    connectedAt: now,
    lastPing: now,
  };

  const success = server.upgrade(req, { data });

  return success ? undefined : new Response('Upgrade failed', { status: 500 });
}

/**
 * WebSocket event handlers for Bun.serve().
 */
export const websocketHandler = {
  open(ws: WSSocket) {
    addConnection(ws);

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: 'connected',
        connectionId: ws.data.connectionId,
        userId: ws.data.userId,
        timestamp: new Date().toISOString(),
      }),
    );
  },

  close(ws: WSSocket) {
    removeConnection(ws);
  },

  message(ws: WSSocket, message: string | Buffer) {
    try {
      const data = JSON.parse(message.toString()) as WSMessage;

      switch (data.action) {
        case 'subscribe':
          subscribeToChannel(ws, data.channel);
          ws.send(JSON.stringify({ type: 'subscribed', channel: data.channel }));
          break;

        case 'unsubscribe':
          unsubscribeFromChannel(ws, data.channel);
          ws.send(JSON.stringify({ type: 'unsubscribed', channel: data.channel }));
          break;

        case 'ping':
          updateLastPing(ws);
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        case 'disconnect':
          // Explicit cleanup from FE
          ws.send(
            JSON.stringify({
              type: 'disconnected',
              connectionId: ws.data.connectionId,
              timestamp: Date.now(),
            }),
          );
          removeConnection(ws);
          ws.close(1000, 'Client requested disconnect');
          break;
      }
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  },
};
