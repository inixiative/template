import { db } from '@template/db';
import { LogLevels, createConsola } from 'consola';
import { env } from '#/config/env';

const baseLog = createConsola({
  level: env.LOG_LEVEL ? LogLevels[env.LOG_LEVEL as keyof typeof LogLevels] : LogLevels.info,
  formatOptions: {
    date: true,
    colors: env.ENVIRONMENT !== 'production',
    compact: env.ENVIRONMENT === 'production',
  },
});

export const log = new Proxy(baseLog, {
  get(target, prop) {
    const scopeId = db.getScopeId();
    const logger = scopeId ? target.withTag(scopeId.slice(0, 8)) : target;
    return Reflect.get(logger, prop);
  },
});
