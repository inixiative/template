import { consolaAdapter } from '@template/shared/logger/consolaAdapter';
import { pinoAdapter } from '@template/shared/logger/pinoAdapter';
import { getLogBroadcasts, getLogScopes, LogScope } from '@template/shared/logger/scope';
import type { LoggerAdapter, LogLevel } from '@template/shared/logger/types';
import { isLocal, isTest } from '@template/shared/utils/env';

const adapters: LoggerAdapter[] = [isLocal || isTest ? consolaAdapter : pinoAdapter];

const logScopeValues = new Set<string>(Object.values(LogScope));

const formatArg = (a: unknown): string => {
  if (a === null || a === undefined) return String(a);
  if (typeof a === 'string') return a;
  if (a instanceof Error) return a.stack ?? a.message;
  return JSON.stringify(a);
};

const compose = (rawArgs: unknown[]): string => {
  const time = new Date().toISOString();
  const lastArg = rawArgs[rawArgs.length - 1];
  const hasManualScope = typeof lastArg === 'string' && logScopeValues.has(lastArg);
  const args = hasManualScope ? rawArgs.slice(0, -1) : rawArgs;
  const scopes = hasManualScope ? [...getLogScopes(), lastArg as string] : getLogScopes();
  const scopeStr = scopes.length ? ` ${scopes.map((s) => `[${s}]`).join(' ')}` : '';
  return `[${time}]${scopeStr} ${args.map(formatArg).join(' ')}`;
};

const fireBroadcasts = (level: LogLevel, msg: string) => {
  for (const fn of getLogBroadcasts()) fn(level, msg);
};

const emit = (level: LogLevel, args: unknown[]) => {
  const msg = compose(args);
  for (const a of adapters) a[level](msg);
  fireBroadcasts(level, msg);
};

export const log: LoggerAdapter = {
  level: process.env.LOG_LEVEL ?? 'info',
  info: (...args) => emit('info', args),
  warn: (...args) => emit('warn', args),
  error: (...args) => emit('error', args),
  debug: (...args) => emit('debug', args),
  fatal: (...args) => emit('fatal', args),
  trace: (...args) => emit('trace', args),
  success: (...args) => emit('success', args),
  box: (...args) => emit('box', args),
  child: () => {
    throw new Error('log.child() not supported — use logScope(id, fn) for ALS-bound scoping');
  },
};
