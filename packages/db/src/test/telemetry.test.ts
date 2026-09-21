/**
 * @atlas
 * @kind test
 * @partOf infrastructure:observability
 * @uses none
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, DbAction, db, HookTiming, registerDbHook } from '@template/db';
import { instrumentRedis } from '@template/db/redis/instrumentRedis';
import { createUser } from '@template/db/test/factories/userFactory';
import { log, withLogContext } from '@template/shared/logger';
import { type LogRecord, observeLogRecords } from '@template/shared/logger/records';
import { captureTraceContext, trace, withSpan } from '@template/shared/telemetry';
import { initializeTelemetry } from '@template/shared/telemetry/initialize';
import Redis from 'ioredis';

const batches: string[] = [];
const receiver = Bun.serve({
  port: 0,
  async fetch(request) {
    batches.push(await request.text());
    return Response.json({});
  },
});
let sdk: ReturnType<typeof initializeTelemetry>;
beforeAll(() => {
  sdk = initializeTelemetry({
    endpoint: receiver.url.toString(),
    headers: {},
    sampleRatio: 1,
    serviceName: 'db-test',
    serviceVersion: 'test',
    environment: 'test',
    role: 'api',
  });
});
afterAll(async () => {
  await sdk.shutdown();
  await receiver.stop();
  clearHookRegistry();
});

describe('database telemetry', () => {
  it('keeps request trace and log fields through a real Prisma mutation and hook', async () => {
    const records: LogRecord[] = [];
    const stop = observeLogRecords((record) => records.push(record));
    let requestTrace = '';
    let hookTrace: string | undefined;
    let queuedContext: Record<string, string> = {};
    const previousLevel = log.level;
    log.level = 'info';
    registerDbHook('telemetry-test', 'User', HookTiming.after, [DbAction.create], async () => {
      hookTrace = trace.getActiveSpan()?.spanContext().traceId;
      log.info({ event: 'hook.ran' }, 'Hook executed');
      db.onCommit(() => {
        queuedContext = captureTraceContext();
      });
    });
    try {
      await withLogContext({ requestId: 'database-request' }, () =>
        withSpan('database-request', {}, async (span) => {
          requestTrace = span.spanContext().traceId;
          const { entity: user } = await createUser({ name: 'telemetry-private-name' });
          await db.user.findUnique({ where: { id: user.id } });
          await db.user.delete({ where: { id: user.id } });
        }),
      );
      expect(hookTrace).toBe(requestTrace);
      expect(queuedContext.traceparent).toContain(requestTrace);
      expect(records.find((record) => record.fields.event === 'hook.ran')?.fields.requestId).toBe('database-request');
      await sdk.forceFlush();
      const output = batches.join('');
      expect(output).toContain('User.create');
      expect(output).toContain('User.findUnique');
      expect(output).not.toContain('telemetry-private-name');
    } finally {
      stop();
      log.level = previousLevel;
      clearHookRegistry();
    }
  });

  it('preserves Redis callback and pipeline rejection semantics', async () => {
    const unhandled: unknown[] = [];
    const collect = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', collect);
    const redis = instrumentRedis(new Redis({ lazyConnect: true }));
    redis.disconnect();
    try {
      await new Promise<void>((resolve) =>
        redis.get('private-key', (error) => {
          expect(error).toBeInstanceOf(Error);
          resolve();
        }),
      );
      const results = await redis.pipeline().get('private-key').exec();
      expect(results?.[0]?.[0]).toBeInstanceOf(Error);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
      await sdk.forceFlush();
      expect(batches.join('')).not.toContain('private-key');
    } finally {
      process.removeListener('unhandledRejection', collect);
      redis.disconnect();
    }
  });
});
