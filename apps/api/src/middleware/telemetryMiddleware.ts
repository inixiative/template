/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import {
  captureTraceContext,
  recordDuration,
  SpanKind,
  SpanStatusCode,
  withRemoteTrace,
  withSpan,
} from '@template/shared/telemetry';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export const telemetryMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.path.startsWith('/health') || c.req.path === '/api/telemetry/browser') return next();
  const method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(c.req.method)
    ? c.req.method
    : '_OTHER';
  return withRemoteTrace(
    { traceparent: c.req.header('traceparent') ?? '', tracestate: c.req.header('tracestate') ?? '' },
    () =>
      withSpan(method, { kind: SpanKind.SERVER }, async (span) => {
        const start = performance.now();
        const traceparent = captureTraceContext().traceparent;
        if (traceparent) c.header('traceparent', traceparent);
        try {
          await next();
        } finally {
          const route = c.req.routePath && c.req.routePath !== '*' ? c.req.routePath : 'unmatched';
          const attributes = {
            'http.request.method': method,
            'http.route': route,
            'http.response.status_code': c.res.status,
          };
          span.updateName(`${method} ${route}`);
          span.setAttributes(attributes);
          if (c.get('requestId')) span.setAttribute('request.id', c.get('requestId'));
          if (c.res.status >= 500 || c.error) span.setStatus({ code: SpanStatusCode.ERROR });
          recordDuration('http.server.request.duration', (performance.now() - start) / 1000, attributes);
        }
      }),
  );
};
