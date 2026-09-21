/**
 * @atlas
 * @kind test
 * @partOf infrastructure:observability
 * @uses none
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { log, withLogContext } from '@template/shared/logger';
import { observeLogRecords } from '@template/shared/logger/records';
import { captureTraceContext, recordDuration, SpanKind, withRemoteTrace, withSpan } from '@template/shared/telemetry';
import { parseOtlpHeaders, readTelemetryConfig, signalExportOptions } from '@template/shared/telemetry/config';
import { createFetchExporter } from '@template/shared/telemetry/fetchExporter';
import { initializeTelemetry } from '@template/shared/telemetry/initialize';
import { installEnvOverrideProxy, withEnv } from '@template/shared/utils/envOverrides';

installEnvOverrideProxy();

type Batch = { path: string; authorization: string | null; body: unknown };
const batches: Batch[] = [];
const receiver = Bun.serve({
  port: 0,
  async fetch(request) {
    batches.push({
      path: new URL(request.url).pathname,
      authorization: request.headers.get('authorization'),
      body: await request.json(),
    });
    return Response.json({});
  },
});
let sdk: ReturnType<typeof initializeTelemetry>;
const oldLevel = log.level;
beforeAll(async () => {
  log.level = 'info';
  sdk = await withEnv(
    {
      OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `${receiver.url}betterstack/v1/logs`,
      OTEL_EXPORTER_OTLP_LOGS_HEADERS: 'Authorization=Bearer%20logs-test-key',
    },
    () =>
      initializeTelemetry({
        endpoint: `${receiver.url}newrelic`,
        headers: { authorization: 'traces-test-key' },
        sampleRatio: 1,
        serviceName: 'telemetry-test-api',
        serviceVersion: 'test',
        environment: 'test',
        role: 'api',
      }),
  );
});
afterAll(async () => {
  log.level = oldLevel;
  await sdk.shutdown();
  await receiver.stop();
});

describe('OTLP pipeline', () => {
  it('exports useful latency distributions for millisecond and second durations', async () => {
    const name = 'test.latency.distribution';
    for (const seconds of [0.001, 0.1, 4]) recordDuration(name, seconds, {});
    await sdk.forceFlush();
    type ExportedMetrics = {
      resourceMetrics?: {
        scopeMetrics: {
          metrics: {
            name: string;
            unit: string;
            histogram?: { dataPoints: { count: number; bucketCounts: number[] }[] };
          }[];
        }[];
      }[];
    };
    const metric = batches
      .flatMap((batch) => (batch.body as ExportedMetrics).resourceMetrics ?? [])
      .flatMap((resource) => resource.scopeMetrics)
      .flatMap((scope) => scope.metrics)
      .find((metric) => metric.name === name);
    expect(metric?.unit).toBe('s');
    const point = metric?.histogram?.dataPoints[0];
    expect(point?.count).toBe(3);
    expect(point?.bucketCounts.filter((count) => count > 0)).toEqual([1, 1, 1]);
  });

  it('exports correlated structured logs, traces and metrics to separate destinations', async () => {
    let parentTrace = '';
    await withLogContext({ requestId: 'request-1' }, () =>
      withSpan('request', { kind: SpanKind.SERVER }, async (span) => {
        parentTrace = span.spanContext().traceId;
        log
          .child({ component: 'reminders', botId: 'bot-1' })
          .info({ event: 'reminder.sent', nested: { password: 'private-value' } }, 'Reminder sent');
        const serializedCarrier = JSON.parse(JSON.stringify(captureTraceContext()));
        await withRemoteTrace(serializedCarrier, () =>
          withSpan('worker', { kind: SpanKind.CONSUMER }, async (worker) => {
            expect(worker.spanContext().traceId).toBe(parentTrace);
          }),
        );
        recordDuration('test.operation.duration', 0.2, { outcome: 'success' });
      }),
    );
    await sdk.forceFlush();
    const logs = batches.filter((batch) => batch.path.includes('logs'));
    expect(logs.length).toBeGreaterThan(0);
    expect(
      logs.every((batch) => batch.path === '/betterstack/v1/logs' && batch.authorization === 'Bearer logs-test-key'),
    ).toBe(true);
    const logsText = JSON.stringify(logs);
    expect(logsText).toContain('reminder.sent');
    expect(logsText).toContain('request-1');
    expect(logsText).toContain('bot-1');
    expect(logsText).toContain(parentTrace);
    expect(logsText).not.toContain('private-value');
    const traces = batches.filter((batch) => batch.path.endsWith('/traces'));
    expect(traces.every((batch) => batch.authorization === 'traces-test-key')).toBe(true);
    expect(JSON.stringify(traces)).toContain(parentTrace);
    expect(JSON.stringify(batches.filter((batch) => batch.path.endsWith('/metrics')))).toContain(
      'test.operation.duration',
    );
  });

  it('preserves tags and filters sensitive values before every observer', () => {
    const records: unknown[] = [];
    const stop = observeLogRecords((record) => records.push(record));
    const circular: Record<string, unknown> = { nested: { apiKey: 'do-not-export' } };
    circular.self = circular;
    log.error(
      {
        circular,
        count: 1n,
        err: new Error('Failed https://example.test/auth?access_token=do-not-export&email=a@b.test'),
      },
      'safe message',
    );
    stop();
    const output = JSON.stringify(records);
    expect(output).not.toContain('do-not-export');
    expect(output).not.toContain('a@b.test');
    expect(output).toContain('[Circular]');
    expect(output).toContain('safe message');
  });

  it('sanitizes positional Prisma errors before composing the log message', () => {
    const records: unknown[] = [];
    const stop = observeLogRecords((record) => records.push(record));
    const error = new Error('Invalid invocation: data: { body: confidential-patient-note }');
    error.name = 'PrismaClientKnownRequestError';
    log.error('Query failed', error);
    stop();
    expect(JSON.stringify(records)).not.toContain('confidential-patient-note');
    expect(JSON.stringify(records)).toContain('Database operation failed');
  });

  it('retains correlation on wide records and never leaks sensitive child bindings into scopes', async () => {
    const records: { fields: Record<string, unknown> }[] = [];
    const stop = observeLogRecords((record) => records.push(record));
    try {
      await withSpan('wide-record', {}, async (span) => {
        log
          .child({ token: 'private-scope-token' })
          .info(Object.fromEntries(Array.from({ length: 110 }, (_, index) => [`field${index}`, index])), 'Wide record');
        expect(records[0]?.fields.trace_id).toBe(span.spanContext().traceId);
        expect(Array.isArray(records[0]?.fields.scopes)).toBe(true);
      });
      expect(JSON.stringify(records)).not.toContain('private-scope-token');
    } finally {
      stop();
    }
  });

  it('isolates observer failures from application code', () => {
    const stop = observeLogRecords(() => {
      throw new Error('sink failed');
    });
    expect(() => log.info('Application continues')).not.toThrow();
    stop();
  });

  it('reports rejected exports without throwing or exposing credentials', async () => {
    const rejecting = Bun.serve({ port: 0, fetch: () => new Response('private response', { status: 401 }) });
    try {
      const exporter = createFetchExporter({
        url: rejecting.url.toString(),
        serialize: () => new TextEncoder().encode('{}'),
      });
      const result = await new Promise<{ code: number; error?: Error }>((resolve) => exporter.export({}, resolve));
      expect(result.code).toBe(1);
      expect(result.error?.message).toBe('OTLP export failed');
      await exporter.shutdown();
    } finally {
      await rejecting.stop();
    }
  });
});

describe('telemetry configuration', () => {
  it('respects literal false and validates enabled configuration', async () => {
    expect(
      await withEnv({ OTEL_ENABLED: 'false', OTEL_EXPORTER_OTLP_ENDPOINT: 'https://example.test' }, () =>
        readTelemetryConfig('api'),
      ),
    ).toBeNull();
    expect(
      withEnv({ OTEL_ENABLED: 'true', OTEL_EXPORTER_OTLP_ENDPOINT: '' }, () => readTelemetryConfig('api')),
    ).rejects.toThrow();
  });
  it('parses encoded credentials without losing equals signs', () => {
    expect(parseOtlpHeaders('Authorization=Bearer%20abc%3D%3D')).toEqual({ Authorization: 'Bearer abc==' });
  });
  it('will not forward default credentials to a different provider', async () => {
    await expect(
      withEnv(
        { OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: 'https://other.test/v1/logs', OTEL_EXPORTER_OTLP_LOGS_HEADERS: undefined },
        () => signalExportOptions('logs', 'https://one.test', { 'api-key': 'private' }),
      ),
    ).rejects.toThrow('explicit signal headers');
  });
});
