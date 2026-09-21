/**
 * @atlas
 * @kind test
 * @partOf infrastructure:observability
 * @uses none
 */
import { afterAll, expect, it } from 'bun:test';
import { withEnv } from '@template/shared/utils/envOverrides';
import { browserTelemetryRouter } from '#/routes/browserTelemetry';

const received: string[] = [];
const receiver = Bun.serve({
  port: 0,
  async fetch(request) {
    received.push(await request.text());
    return Response.json({});
  },
});
afterAll(() => receiver.stop());
const payload = {
  app: 'superadmin',
  spans: [
    {
      traceId: 'a'.repeat(32),
      spanId: 'b'.repeat(16),
      name: 'browser.error',
      startTimeMs: Date.now(),
      durationMs: 1,
      error: true,
      errorMessage: 'Failed https://example.test?token=private-value',
    },
  ],
};
const environment = {
  OTEL_ENABLED: 'true',
  OTEL_BROWSER_ENABLED: 'true',
  OTEL_EXPORTER_OTLP_ENDPOINT: receiver.url.toString(),
  OTEL_EXPORTER_OTLP_HEADERS: '',
  SUPERADMIN_URL: 'https://admin.example.test',
};
const send = (origin: string, body: unknown = payload) =>
  browserTelemetryRouter.request('/', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

it('validates browser events and forwards sanitized OTLP without exposing credentials', async () => {
  await withEnv(environment, async () => {
    expect((await send('https://admin.example.test')).status).toBe(202);
    expect(received.join('')).toContain('resourceSpans');
    expect(received.join('')).toContain('browser');
    expect(received.join('')).not.toContain('private-value');
    expect((await send('https://untrusted.example.test')).status).toBe(403);
    expect((await send('https://admin.example.test', { ...payload, endpoint: 'https://attacker.test' })).status).toBe(
      400,
    );
    expect((await send('https://admin.example.test', { noise: 'x'.repeat(70_000) })).status).toBe(413);
  });
});

it('rejects ingestion when disabled', async () => {
  await withEnv({ ...environment, OTEL_BROWSER_ENABLED: 'false' }, async () =>
    expect((await send('https://admin.example.test')).status).toBe(404),
  );
});

it('accepts exact configured HTTP origins with URL paths and rejects lookalikes', async () => {
  await withEnv({ ...environment, SUPERADMIN_URL: 'https://admin.example.test/dashboard/' }, async () => {
    expect((await send('https://admin.example.test')).status).toBe(202);
    expect((await send('https://admin.example.test.attacker.test')).status).toBe(403);
    expect((await send('http://admin.example.test')).status).toBe(403);
  });
  await withEnv(
    { ...environment, SUPERADMIN_URL: 'file:///admin', WEB_URL: undefined, ADMIN_URL: 'invalid' },
    async () => {
      expect((await send('null')).status).toBe(403);
    },
  );
});
