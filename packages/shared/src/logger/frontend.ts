import { LogLevels, createConsola, type ConsolaInstance } from 'consola';

type LogLevel = 'silent' | 'fatal' | 'error' | 'warn' | 'log' | 'info' | 'debug' | 'trace' | 'verbose';

/**
 * Frontend app scopes
 */
export enum FrontendScope {
  web = 'web',
  admin = 'admin',
  superadmin = 'super',
}

const getLogLevel = (): number => {
  // Check for browser environment and window.LOG_LEVEL
  const level = (typeof globalThis !== 'undefined' && 'window' in globalThis
    ? (globalThis as any).LOG_LEVEL
    : undefined) as LogLevel | undefined;
  if (level && level in LogLevels) return LogLevels[level];
  return LogLevels.info;
};

/**
 * Create a frontend logger with a fixed base scope.
 * Use this in web/admin/superadmin apps.
 *
 * @example
 * // In apps/web
 * export const log = createFrontendLogger(FrontendScope.web);
 * log.info('page loaded');  // [web] page loaded
 *
 * // In apps/admin
 * export const log = createFrontendLogger(FrontendScope.admin);
 * log.error('failed');  // [admin] failed
 */
export const createFrontendLogger = (scope: FrontendScope | string): ConsolaInstance => {
  const base = createConsola({
    level: getLogLevel(),
    formatOptions: {
      date: false,
      colors: true,
      compact: false,
    },
  });

  return base.withTag(scope);
};
