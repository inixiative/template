/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { redactLogValue } from '@template/shared/logger/redact';
import { browserTelemetrySchema } from '@template/shared/telemetry/browserSchema';
import { readTelemetryConfig, signalExportOptions } from '@template/shared/telemetry/config';
import { bodyLimit } from 'hono/body-limit';
import { ipIdentity } from '#/middleware/rateLimit/identities';
import { rateLimit } from '#/middleware/rateLimit/rateLimit';
import type { AppEnv } from '#/types/appEnv';

export const browserTelemetryRouter = new OpenAPIHono<AppEnv>();
browserTelemetryRouter.use('*', bodyLimit({ maxSize: 64 * 1024 }));
browserTelemetryRouter.use(
  '*',
  rateLimit([
    { scope: 'telemetry:ip', windowMs: 60_000, max: 30, key: ipIdentity },
    { scope: 'telemetry:global', windowMs: 60_000, max: 1000, key: () => 'all' },
  ]),
);
browserTelemetryRouter.post('/', async (c) => {
  if (process.env.OTEL_BROWSER_ENABLED !== 'true') return c.body(null, 404);
  const config = readTelemetryConfig('api');
  if (!config) return c.body(null, 404);
  const origin = c.req.header('origin');
  if (!origin || ![process.env.WEB_URL, process.env.ADMIN_URL, process.env.SUPERADMIN_URL].includes(origin))
    return c.body(null, 403);
  const parsed = browserTelemetrySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.body(null, 400);
  if (parsed.data.spans.some((span) => Math.abs(Date.now() - span.startTimeMs) > 3_600_000)) return c.body(null, 400);
  const nanos = (milliseconds: number) => (BigInt(Math.trunc(milliseconds * 1000)) * 1000n).toString();
  const attribute = (key: string, value: unknown) => ({ key, value: { stringValue: String(redactLogValue(value)) } });
  const spans = parsed.data.spans.map((span) => ({
    traceId: span.traceId,
    spanId: span.spanId,
    name: span.name,
    kind: span.name === 'api.request' ? 3 : 1,
    startTimeUnixNano: nanos(span.startTimeMs),
    endTimeUnixNano: nanos(span.startTimeMs + span.durationMs),
    flags: 1,
    status: { code: span.error ? 2 : 0 },
    attributes: [
      attribute('telemetry.source', 'browser'),
      ...(span.route ? [attribute('http.route', span.route)] : []),
      ...(span.method ? [attribute('http.request.method', span.method)] : []),
      ...(span.status !== undefined
        ? [{ key: 'http.response.status_code', value: { intValue: String(span.status) } }]
        : []),
      ...(span.errorType ? [attribute('error.type', span.errorType)] : []),
    ],
    events: span.error
      ? [
          {
            name: 'exception',
            timeUnixNano: nanos(span.startTimeMs + span.durationMs),
            attributes: [
              attribute('exception.type', span.errorType ?? 'Error'),
              attribute('exception.message', span.errorMessage ?? 'Request failed'),
              attribute('exception.stacktrace', span.errorStack ?? ''),
            ],
          },
        ]
      : [],
  }));
  const target = signalExportOptions('traces', config.endpoint, config.headers);
  try {
    const response = await fetch(target.url, {
      method: 'POST',
      redirect: 'error',
      headers: { ...target.headers, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        resourceSpans: [
          {
            resource: {
              attributes: [
                attribute('service.name', `${config.serviceName.replace(/-api$/, '')}-${parsed.data.app}`),
                attribute('deployment.environment.name', config.environment),
                attribute('telemetry.source', 'browser'),
              ],
            },
            scopeSpans: [{ scope: { name: 'template.browser' }, spans }],
          },
        ],
      }),
    });
    await response.body?.cancel();
    return c.body(null, response.ok ? 202 : 503);
  } catch {
    return c.body(null, 503);
  }
});
