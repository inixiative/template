/**
 * @atlas
 * @partOf primitive:ui
 */
import { type ConsolaInstance, createConsola, LogLevels } from 'consola';

type LogLevel = 'silent' | 'fatal' | 'error' | 'warn' | 'log' | 'info' | 'debug' | 'trace' | 'verbose';

export enum FrontendScope {
  web = 'web',
  admin = 'admin',
  superadmin = 'super',
  ui = 'ui',
}

const getLogLevel = (): number => {
  const level = (
    typeof globalThis !== 'undefined' && 'window' in globalThis
      ? (globalThis as { LOG_LEVEL?: unknown }).LOG_LEVEL
      : undefined
  ) as LogLevel | undefined;
  if (level && level in LogLevels) return LogLevels[level];
  return LogLevels.info;
};

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
