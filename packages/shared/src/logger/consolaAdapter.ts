/**
 * @atlas
 * @partOf primitive:shared
 */
import type { LoggerAdapter } from '@template/shared/logger/types';
import { isLocal, isTest } from '@template/shared/utils/env';
import { createConsola, LogLevels } from 'consola';

const consola = createConsola({
  level: LogLevels[process.env.LOG_LEVEL as keyof typeof LogLevels] ?? LogLevels.info,
  formatOptions: { date: false, colors: isLocal || isTest, compact: true, columns: 0 },
});

export const consolaAdapter: LoggerAdapter = {
  level: process.env.LOG_LEVEL ?? 'info',
  info: (msg) => consola.info(msg),
  warn: (msg) => consola.warn(msg),
  error: (msg) => consola.error(msg),
  debug: (msg) => consola.debug(msg),
  fatal: (msg) => consola.fatal(msg),
  trace: (msg) => consola.trace(msg),
  success: (msg) => consola.success(msg),
  box: (msg) => consola.box(msg as string),
  child: () => {
    throw new Error('child() not supported — use logScope(id, fn) for ALS-bound scoping');
  },
};
