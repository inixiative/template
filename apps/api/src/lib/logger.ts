import { db } from '@template/db';
import { LogLevels, createConsola } from 'consola';
import { isLocal, isProd, isTest } from '#/config/env';

const getLogLevel = (): number => {
  if (process.env.LOG_LEVEL) return LogLevels[process.env.LOG_LEVEL];
  return LogLevels.info;
};

const baseLog = createConsola({
  level: getLogLevel(),
  formatOptions: {
    date: true,
    colors: isLocal || isTest,
    compact: isProd,
  },
});

export const log = new Proxy(baseLog, {
  get(target, prop) {
    const scopeId = db.getScopeId();
    const logger = scopeId ? target.withTag(scopeId.slice(0, 8)) : target;
    return Reflect.get(logger, prop);
  },
});
