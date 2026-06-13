/**
 * @atlas
 * @kind adapter
 * @partOf primitive:shared
 * @uses none
 */
import type { LoggerAdapter } from '@template/shared/logger/types';
import { pino } from 'pino';

// Native pino instance — exported for SDKs that genuinely need pino's ILogger
// (Baileys etc.). They use this directly and get native .child(), structured
// payloads, etc. Our facade fans to pinoAdapter (below), which is the same
// instance wrapped in our LoggerAdapter contract.
export const pinoLogger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

export const pinoAdapter: LoggerAdapter = {
  level: pinoLogger.level,
  info: (msg) => pinoLogger.info(msg as string),
  warn: (msg) => pinoLogger.warn(msg as string),
  error: (msg) => pinoLogger.error(msg as string),
  debug: (msg) => pinoLogger.debug(msg as string),
  fatal: (msg) => pinoLogger.fatal(msg as string),
  trace: (msg) => pinoLogger.trace(msg as string),
  success: (msg) => pinoLogger.info(msg as string),
  box: (msg) => pinoLogger.info(msg as string),
  child: () => {
    throw new Error('child() not supported — use logScope(id, fn), or import pinoLogger directly for SDK use');
  },
};
