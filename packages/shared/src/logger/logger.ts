import { getLogBroadcasts, getLogScopes, LogScope } from '@template/shared/logger/scope';
import { isLocal, isTest } from '@template/shared/utils/env';
import { type ConsolaInstance, createConsola, LogLevels } from 'consola';

type LogLevel = 'silent' | 'fatal' | 'error' | 'warn' | 'log' | 'info' | 'debug' | 'trace' | 'verbose';

const getLogLevel = (): number => {
  const level = process.env.LOG_LEVEL as LogLevel | undefined;
  if (level && level in LogLevels) return LogLevels[level];
  return LogLevels.info;
};

const baseConsola = createConsola({
  level: getLogLevel(),
  formatOptions: {
    date: false,
    colors: isLocal || isTest,
    compact: true,
    columns: 0,
  },
});

const timestamp = () => new Date().toISOString();
const logScopeValues = new Set<string>(Object.values(LogScope));
const logMethods = new Set(['fatal', 'error', 'warn', 'log', 'info', 'debug', 'trace', 'verbose']);

const fireBroadcasts = (level: string, args: unknown[]) => {
  const broadcasts = getLogBroadcasts();
  if (broadcasts.length === 0) return;

  const message = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  for (const fn of broadcasts) {
    try {
      fn(level, message);
    } catch {
      // Fire-and-forget — broadcast errors never affect the log call
    }
  }
};

/**
 * Logger with automatic scope support and broadcasting.
 *
 * @example
 * log.info('message');                    // uses logScope context
 * log.info('message', LogScope.worker);   // manual scope (overrides logScope)
 *
 * // Broadcasting: register targets that receive all log calls in scope
 * logBroadcast((level, msg) => job.log(msg), () => {
 *   log.info('sent to stdout AND job.log()');
 * });
 */
export const log: ConsolaInstance = new Proxy(baseConsola, {
  get(target, prop) {
    const value = Reflect.get(target, prop);

    // Wrap logging methods to check for LogScope as last arg
    if (typeof value === 'function') {
      return (...args: unknown[]) => {
        const lastArg = args[args.length - 1];
        const hasManualScope = typeof lastArg === 'string' && logScopeValues.has(lastArg);
        const level = typeof prop === 'string' ? prop : '';
        const isBroadcastable = logMethods.has(level);

        const time = timestamp();
        const logger = target;

        if (hasManualScope) {
          // Prepend both timestamp and scope to message
          const scope = lastArg as string;
          const msgArgs = args.slice(0, -1);
          if (isBroadcastable) fireBroadcasts(level, [`[${time}] [${scope}]`, ...msgArgs]);
          return (logger[prop as keyof ConsolaInstance] as (...args: unknown[]) => unknown)(
            `[${time}] [${scope}]`,
            ...msgArgs,
          );
        }

        // Prepend timestamp and automatic scopes to message
        const scopes = getLogScopes();
        if (scopes.length > 0) {
          const scopeStr = scopes.map((s) => `[${s}]`).join(' ');
          if (isBroadcastable) fireBroadcasts(level, [`[${time}] ${scopeStr}`, ...args]);
          return (logger[prop as keyof ConsolaInstance] as (...args: unknown[]) => unknown)(
            `[${time}] ${scopeStr}`,
            ...args,
          );
        }

        if (isBroadcastable) fireBroadcasts(level, [`[${time}]`, ...args]);
        return (logger[prop as keyof ConsolaInstance] as (...args: unknown[]) => unknown)(`[${time}]`, ...args);
      };
    }

    return value;
  },
});
