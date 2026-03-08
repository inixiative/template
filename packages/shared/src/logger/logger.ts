import { getLogScopes, LogScope } from '@template/shared/logger/scope';
import { isLocal, isProd, isTest } from '@template/shared/utils/env';
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

/**
 * Logger with automatic scope support.
 *
 * @example
 * log.info('message');                    // uses logScope context
 * log.info('message', LogScope.worker);   // manual scope (overrides logScope)
 */
export const log: ConsolaInstance = new Proxy(baseConsola, {
  get(target, prop) {
    const value = Reflect.get(target, prop);

    // Wrap logging methods to check for LogScope as last arg
    if (typeof value === 'function') {
      return (...args: unknown[]) => {
        const lastArg = args[args.length - 1];
        const hasManualScope = typeof lastArg === 'string' && logScopeValues.has(lastArg);

        const time = timestamp();
        const logger = target;

        if (hasManualScope) {
          // Prepend both timestamp and scope to message
          const scope = lastArg as string;
          return (logger[prop as keyof ConsolaInstance] as Function)(`[${time}] [${scope}]`, ...args.slice(0, -1));
        }

        // Prepend timestamp and automatic scopes to message
        const scopes = getLogScopes();
        if (scopes.length > 0) {
          const scopeStr = scopes.map((s) => `[${s}]`).join(' ');
          return (logger[prop as keyof ConsolaInstance] as Function)(`[${time}] ${scopeStr}`, ...args);
        }

        return (logger[prop as keyof ConsolaInstance] as Function)(`[${time}]`, ...args);
      };
    }

    return value;
  },
});
