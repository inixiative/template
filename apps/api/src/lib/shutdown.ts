/**
 * @atlas
 * @kind service
 * @partOf primitive:lifecycle
 * @uses primitive:shared
 */
import { LogScope, log } from '@template/shared/logger';

type ShutdownHandler = () => Promise<void> | void;

const handlers: ShutdownHandler[] = [];
let isShuttingDown = false;

export const onShutdown = (handler: ShutdownHandler): void => {
  handlers.push(handler);
};

export const initGracefulShutdown = (
  options: { timeout?: number; onStart?: () => void; onComplete?: () => void } = {},
): void => {
  const { timeout = 30_000, onStart, onComplete } = options;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log.info(`${signal} received, starting graceful shutdown...`, LogScope.api);
    onStart?.();

    // Force exit after timeout
    const forceExit = setTimeout(() => {
      log.error('Shutdown timeout - forcing exit', LogScope.api);
      process.exit(1);
    }, timeout);

    try {
      // Run handlers sequentially
      for (const handler of handlers) {
        await handler();
      }

      clearTimeout(forceExit);
      log.info('Graceful shutdown complete', LogScope.api);
      onComplete?.();
      process.exit(0);
    } catch (error) {
      log.error(`Shutdown error: ${error}`, LogScope.api);
      clearTimeout(forceExit);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};
