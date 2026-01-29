import { LogLevels, createConsola, type ConsolaInstance } from 'consola';
import { isLocal, isProd, isTest } from '../utils/env';
import { getLogScopes } from './scope';

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
    compact: isProd,
  },
});

const timestamp = () => new Date().toISOString();

export const log: ConsolaInstance = new Proxy(baseConsola, {
  get(target, prop) {
    let logger = target.withTag(timestamp());
    for (const scope of getLogScopes()) {
      logger = logger.withTag(scope.slice(0, 8));
    }
    return Reflect.get(logger, prop);
  },
});
