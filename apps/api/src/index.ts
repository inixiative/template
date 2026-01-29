import { registerHooks } from '#/hooks';
import { getRedisClient } from '#/lib/clients/redis';
import { log } from '@template/shared/logger';
import { initGracefulShutdown, onShutdown } from '#/lib/shutdown';
import { drainConnections, handleUpgrade, initWebSocketPubSub, websocketHandler } from '#/ws';
import { app } from './app';

// Register database hooks (cache clear, webhooks)
registerHooks();

// Initialize graceful shutdown (must be first)
initGracefulShutdown({ timeout: 30_000 });

// Initialize WebSocket pub/sub for cross-server broadcasting
initWebSocketPubSub();

const server = Bun.serve({
  port: process.env.PORT,
  fetch(req, server) {
    // Handle WebSocket upgrade requests
    if (req.headers.get('upgrade') === 'websocket') {
      return handleUpgrade(req, server);
    }
    return app.fetch(req);
  },
  websocket: websocketHandler,
});

// Register shutdown handlers (order matters)
onShutdown(async () => {
  // 1. Stop accepting new connections
  server.stop();
  log.info('Stopped accepting new connections');
});

onShutdown(async () => {
  // 2. Drain WebSocket connections
  await drainConnections();
});

onShutdown(async () => {
  // 3. Close Redis connections
  try {
    const redis = getRedisClient();
    await redis.quit();
    log.success('Redis connections closed');
  } catch {
    // Redis might not be initialized
  }
});

log.box(`API running at http://localhost:${server.port}`);
log.info('OpenAPI docs', { url: `http://localhost:${server.port}/openapi/docs` });
log.info('Health check', { url: `http://localhost:${server.port}/health` });
log.info('WebSocket', { url: `ws://localhost:${server.port}` });
