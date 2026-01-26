import { log } from '#/lib/logger';
/**
 * Graceful Shutdown Handler
 *
 * Handles SIGTERM/SIGINT signals to gracefully shut down:
 * 1. WebSocket - notify clients to reconnect elsewhere
 * 2. BullMQ Worker - stop accepting jobs, finish current ones
 * 3. Redis - close connections cleanly
 */

type ShutdownHandler = () => Promise<void> | void;

const handlers: ShutdownHandler[] = [];
let isShuttingDown = false;

/**
 * Register a shutdown handler.
 * Handlers run in order of registration.
 */
export function onShutdown(handler: ShutdownHandler): void {
  handlers.push(handler);
}

/**
 * Initialize graceful shutdown listeners.
 * Call once at server startup.
 */
export function initGracefulShutdown(
  options: {
    timeout?: number;
    onStart?: () => void;
    onComplete?: () => void;
  } = {},
): void {
  const { timeout = 30_000, onStart, onComplete } = options;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log.info(`\n⏳ ${signal} received, starting graceful shutdown...`);
    onStart?.();

    // Force exit after timeout
    const forceExit = setTimeout(() => {
      log.error('❌ Shutdown timeout - forcing exit');
      process.exit(1);
    }, timeout);

    try {
      // Run handlers sequentially
      for (const handler of handlers) {
        await handler();
      }

      clearTimeout(forceExit);
      log.info('✅ Graceful shutdown complete');
      onComplete?.();
      process.exit(0);
    } catch (error) {
      log.error('❌ Shutdown error:', error);
      clearTimeout(forceExit);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Check if shutdown is in progress.
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}
