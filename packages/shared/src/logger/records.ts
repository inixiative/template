/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { LogLevel } from '@template/shared/logger/types';

export type LogRecord = { level: LogLevel; message: string; fields: Record<string, unknown>; timestamp: Date };
let serviceFields: Record<string, unknown> = {};
export const setLogService = (fields: Record<string, unknown>): void => {
  serviceFields = fields;
};
const observers = new Set<(record: LogRecord) => void>();
const context = new AsyncLocalStorage<Record<string, unknown>>();

export const withLogContext = <T>(fields: Record<string, unknown>, fn: () => T): T =>
  context.run({ ...context.getStore(), ...fields }, fn);
export const getLogContext = (): Record<string, unknown> => ({
  'service.name': process.env.OTEL_SERVICE_NAME ?? 'template',
  'deployment.environment.name': process.env.ENVIRONMENT ?? 'local',
  ...serviceFields,
  ...context.getStore(),
});
export const observeLogRecords = (observer: (record: LogRecord) => void): (() => void) => {
  observers.add(observer);
  return () => {
    observers.delete(observer);
  };
};
export const publishLogRecord = (record: LogRecord): void => {
  for (const observer of observers) {
    try {
      observer(record);
    } catch {}
  }
};
