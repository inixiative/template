/**
 * @atlas
 * @kind adapter
 * @partOf primitive:shared
 * @uses none
 */

import { redactLogValue } from '@template/shared/logger/redact';
import type { LoggerAdapter } from '@template/shared/logger/types';
import { pino } from 'pino';

const nativeOptions = {
  formatters: { bindings: (bindings: Record<string, unknown>) => redactLogValue(bindings) as Record<string, unknown> },
  hooks: {
    logMethod(this: import('pino').Logger, args: Parameters<import('pino').LogFn>, method: import('pino').LogFn) {
      return method.apply(this, args.map((arg) => redactLogValue(arg)) as Parameters<import('pino').LogFn>);
    },
  },
};
export const pinoLogger = pino({ ...nativeOptions, level: process.env.LOG_LEVEL ?? 'info' });
const nativeChild = pinoLogger.child;
pinoLogger.child = function (this: import('pino').Logger, bindings, options) {
  return nativeChild.call(this, redactLogValue(bindings) as Record<string, unknown>, options);
} as typeof pinoLogger.child;
const pinoSink = pino({ level: 'trace' });

export const pinoAdapter: LoggerAdapter = {
  level: pinoLogger.level,
  info: (fields, msg) => pinoSink.info(fields as object, msg as string),
  warn: (fields, msg) => pinoSink.warn(fields as object, msg as string),
  error: (fields, msg) => pinoSink.error(fields as object, msg as string),
  debug: (fields, msg) => pinoSink.debug(fields as object, msg as string),
  fatal: (fields, msg) => pinoSink.fatal(fields as object, msg as string),
  trace: (fields, msg) => pinoSink.trace(fields as object, msg as string),
  success: (fields, msg) => pinoSink.info(fields as object, msg as string),
  box: (fields, msg) => pinoSink.info(fields as object, msg as string),
  child: () => {
    throw new Error('child() not supported — use logScope(id, fn), or import pinoLogger directly for SDK use');
  },
};
