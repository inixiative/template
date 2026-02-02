import { registerHooks } from '#/hooks';
import { getRedisClient } from '@template/db';
import { log, LogScope } from '@template/shared/logger';
import { initGracefulShutdown, onShutdown } from '#/lib/shutdown';
import { drainConnections, handleUpgrade, initWebSocketPubSub, websocketHandler } from '#/ws';
import { initializeOpenTelemetry } from '#/config/otel';
import { app } from './app';

// Initialize OpenTelemetry (skipped in local/test, requires OTEL_EXPORTER_OTLP_ENDPOINT)
await initializeOpenTelemetry();

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
  log.info('Stopped accepting new connections', LogScope.api);
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
    log.success('Redis connections closed', LogScope.api);
  } catch {
    // Redis might not be initialized
  }
});

log.box(`API running at http://localhost:${server.port}`, LogScope.api);
log.info(`OpenAPI docs: http://localhost:${server.port}/openapi/docs`, LogScope.api);
log.info(`Health check: http://localhost:${server.port}/health`, LogScope.api);
log.info(`WebSocket: ws://localhost:${server.port}`, LogScope.api);
