/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { context, recordDuration, SpanKind, SpanStatusCode, trace } from '@template/shared/telemetry';
import type Redis from 'ioredis';

export const instrumentRedis = (redis: Redis): Redis => {
  const sendCommand = redis.sendCommand;
  redis.sendCommand = function (command, stream) {
    const operation = command.name.toUpperCase();
    if (
      [
        'AUTH',
        'HELLO',
        'INFO',
        'PING',
        'CLIENT',
        'BRPOP',
        'BLPOP',
        'BZPOPMIN',
        'BZPOPMAX',
        'SUBSCRIBE',
        'PSUBSCRIBE',
        'UNSUBSCRIBE',
        'PUNSUBSCRIBE',
      ].includes(operation)
    )
      return sendCommand.call(this, command, stream);
    const attributes = { 'db.system.name': 'redis', 'db.operation.name': operation };
    const span = trace.getTracer('template').startSpan(`redis.${operation}`, { kind: SpanKind.CLIENT, attributes });
    const start = performance.now();
    const finish = (outcome: 'success' | 'error', error?: unknown) => {
      if (outcome === 'error') {
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.setAttribute('error.type', error instanceof Error ? error.name : 'UnknownError');
      }
      span.end();
      recordDuration('db.client.operation.duration', (performance.now() - start) / 1000, { ...attributes, outcome });
    };
    try {
      const result = context.with(trace.setSpan(context.active(), span), () => sendCommand.call(this, command, stream));
      void Promise.resolve(result).then(
        () => finish('success'),
        (error) => finish('error', error),
      );
      return result;
    } catch (error) {
      finish('error', error);
      throw error;
    }
  };
  return redis;
};
