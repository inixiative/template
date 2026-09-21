/**
 * @atlas
 * @kind service
 * @partOf primitive:shared, infrastructure:observability
 * @uses none
 */
import { context, isSpanContextValid, trace } from '@opentelemetry/api';
import { consolaAdapter } from '@template/shared/logger/consolaAdapter';
import { pinoAdapter } from '@template/shared/logger/pinoAdapter';
import { getLogContext, publishLogRecord } from '@template/shared/logger/records';
import { redactLogValue, stringifyLogValue } from '@template/shared/logger/redact';
import { getLogBroadcasts, getLogScopes, LogScope, logScope } from '@template/shared/logger/scope';
import type { LoggerAdapter, LogLevel } from '@template/shared/logger/types';
import { isLocal, isTest } from '@template/shared/utils/env';

const adapters: LoggerAdapter[] = [isLocal || isTest ? consolaAdapter : pinoAdapter];
const scopeValues = new Set<string>(Object.values(LogScope));
const levels: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  success: 30,
  box: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 100,
};
let minimumLevel: string = process.env.LOG_LEVEL ?? 'info';
const childLabel = (bindings?: Record<string, unknown>): string => {
  const safe = redactLogValue(bindings ?? {}) as Record<string, unknown>;
  return String(safe.class ?? Object.values(safe)[0] ?? 'child');
};

const emit = (level: LogLevel, rawArgs: unknown[], bindings: Record<string, unknown>) => {
  if (levels[level]! < (levels[minimumLevel] ?? 30)) return;
  const last = rawArgs.at(-1);
  const manualScope = typeof last === 'string' && scopeValues.has(last);
  const args = manualScope ? rawArgs.slice(0, -1) : rawArgs;
  const fields: Record<string, unknown> = { ...getLogContext(), ...bindings };
  const messages: string[] = [];
  for (const arg of args) {
    if (arg instanceof Error) {
      fields.err = arg;
      messages.push((redactLogValue(arg) as { message: string }).message);
    } else if (arg && typeof arg === 'object' && !Array.isArray(arg)) Object.assign(fields, arg);
    else messages.push(typeof arg === 'string' ? arg : stringifyLogValue(arg));
  }
  fields.scopes = manualScope ? [...getLogScopes(), last] : getLogScopes();
  const activeSpan = trace.getSpan(context.active())?.spanContext();
  const span = activeSpan && isSpanContextValid(activeSpan) ? activeSpan : undefined;
  if (span) {
    fields.trace_id = span.traceId;
    fields.span_id = span.spanId;
  }
  let safeFields: Record<string, unknown> = {
    ...(redactLogValue(fields) as Record<string, unknown>),
    scopes: redactLogValue(fields.scopes),
    ...(span ? { trace_id: span.traceId, span_id: span.spanId } : {}),
  };
  if (JSON.stringify(safeFields).length > 16_000)
    safeFields = {
      scopes: safeFields.scopes,
      trace_id: safeFields.trace_id,
      span_id: safeFields.span_id,
      truncated: true,
    };
  const message = redactLogValue(messages.join(' ')) as string;
  const record = { level, message, fields: safeFields, timestamp: new Date() };
  for (const adapter of adapters) adapter[level](safeFields, message);
  publishLogRecord(record);
  const scopes = (safeFields.scopes as string[]).map((scope) => `[${scope}]`).join(' ');
  const formatted = `${scopes} ${message} ${JSON.stringify(safeFields)}`.trim();
  for (const broadcast of getLogBroadcasts()) {
    try {
      Promise.resolve(broadcast(level, formatted)).catch(() => {});
    } catch {}
  }
};

const createLogger = (bindings: Record<string, unknown> = {}, scope?: string): LoggerAdapter => {
  const method =
    (level: LogLevel) =>
    (...args: unknown[]) =>
      scope ? logScope(scope, () => emit(level, args, bindings)) : emit(level, args, bindings);
  return {
    get level() {
      return minimumLevel;
    },
    set level(value: string) {
      minimumLevel = value;
    },
    info: method('info'),
    warn: method('warn'),
    error: method('error'),
    debug: method('debug'),
    fatal: method('fatal'),
    trace: method('trace'),
    success: method('success'),
    box: method('box'),
    child: (child = {}) =>
      createLogger({ ...bindings, ...child }, scope ? `${scope}:${childLabel(child)}` : childLabel(child)),
  };
};
export const log = createLogger();
