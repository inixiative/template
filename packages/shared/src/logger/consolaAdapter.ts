/**
 * @atlas
 * @kind adapter
 * @partOf primitive:shared
 * @uses none
 */
import type { LoggerAdapter } from '@template/shared/logger/types';
import { isLocal, isTest } from '@template/shared/utils/env';
import { createConsola, LogLevels } from 'consola';

const consola = createConsola({
  level: LogLevels.trace,
  formatOptions: { date: false, colors: isLocal || isTest, compact: true, columns: 0 },
});

export const consolaAdapter: LoggerAdapter = {
  level: process.env.LOG_LEVEL ?? 'info',
  info: (fields, msg) => consola.info(`${msg} ${JSON.stringify(fields)}`),
  warn: (fields, msg) => consola.warn(`${msg} ${JSON.stringify(fields)}`),
  error: (fields, msg) => consola.error(`${msg} ${JSON.stringify(fields)}`),
  debug: (fields, msg) => consola.debug(`${msg} ${JSON.stringify(fields)}`),
  fatal: (fields, msg) => consola.fatal(`${msg} ${JSON.stringify(fields)}`),
  trace: (fields, msg) => consola.trace(`${msg} ${JSON.stringify(fields)}`),
  success: (fields, msg) => consola.success(`${msg} ${JSON.stringify(fields)}`),
  box: (fields, msg) => consola.box(`${msg} ${JSON.stringify(fields)}`),
  child: () => {
    throw new Error('child() not supported — use logScope(id, fn) for ALS-bound scoping');
  },
};
