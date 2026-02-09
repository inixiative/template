import { type ConsolaInstance, createConsola, LogLevels, type LogType } from 'consola';
import { isLocal, isProd, isTest } from '#/utils';
import { getLogScopes, LogScope } from './scope';

const getLogLevel = (): number => {
  const level = process.env.LOG_LEVEL as LogType | undefined;
  if (level && level in LogLevels) return LogLevels[level];
  return LogLevels.info;
};

const baseConsola = createConsola({
  level: getLogLevel(),
  formatOptions: {
    date: false,
    colors: isLocal || isTest,
    compact: isProd,
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

        let logger = target.withTag(timestamp());

        if (hasManualScope) {
          // Manual scope overrides all automatic scopes
          logger = logger.withTag((lastArg as string).slice(0, 8));
          return (logger[prop as keyof ConsolaInstance] as Function)(...args.slice(0, -1));
        }

        // No manual scope - use automatic scopes from logScope()
        for (const scope of getLogScopes()) {
          logger = logger.withTag(scope.slice(0, 8));
        }
        return (logger[prop as keyof ConsolaInstance] as Function)(...args);
      };
    }

    return value;
  },
});
