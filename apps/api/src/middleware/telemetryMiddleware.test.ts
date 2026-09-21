/**
 * @atlas
 * @kind test
 * @partOf infrastructure:observability
 * @uses none
 */
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { log } from '@template/shared/logger';
import { type LogRecord, observeLogRecords } from '@template/shared/logger/records';
import { initializeTelemetry } from '@template/shared/telemetry/initialize';
import { Hono } from 'hono';
import { traceJob } from '#/jobs/traceJob';
import { telemetryMiddleware } from '#/middleware/telemetryMiddleware';
import type { AppEnv } from '#/types/appEnv';

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
    serviceName: 'api-test',
    serviceVersion: 'test',
    environment: 'test',
    role: 'api',
  });
});
afterAll(async () => {
  await sdk.shutdown();
  await receiver.stop();
});

it('joins a browser trace and uses route templates instead of user identifiers', async () => {
  const app = new Hono<AppEnv>();
  app.use('*', telemetryMiddleware);
  app.get('/users/:id', (c) => c.json({ ok: true }));
  const traceId = 'a'.repeat(32);
  const response = await app.request('/users/private-user-id?token=private-token', {
    headers: { traceparent: `00-${traceId}-${'b'.repeat(16)}-01` },
  });
  expect(response.headers.get('traceparent')).toContain(traceId);
  await sdk.forceFlush();
  const output = batches.join('');
  expect(output).toContain('GET /users/:id');
  expect(output).not.toContain('private-user-id');
  expect(output).not.toContain('private-token');
});

it('keeps failed job logs correlated with its remote trace and attempt', async () => {
  const records: LogRecord[] = [];
  const stop = observeLogRecords((record) => records.push(record));
  const oldLevel = log.level;
  log.level = 'error';
  try {
    const traceId = 'c'.repeat(32);
    await expect(
      traceJob(
        {
          name: 'sendReminder',
          id: 'job-1',
          attemptsMade: 2,
          data: { traceContext: { traceparent: `00-${traceId}-${'d'.repeat(16)}-01` } },
        },
        async () => {
          throw new Error('Delivery failed');
        },
      ),
    ).rejects.toThrow('Delivery failed');
    expect(records[0]?.fields).toMatchObject({ trace_id: traceId, jobId: 'job-1', attempt: 3 });
  } finally {
    stop();
    log.level = oldLevel;
  }
});
