import { Elysia } from 'elysia';
import { context, SpanStatusCode } from '@opentelemetry/api';

export const telemetry = new Elysia({ name: 'telemetry' })
  .derive(({ request, store, tracer }) => {
    if (!store.telemetryEnabled || !tracer) return {};
    
    const traceParent = request.headers.get('traceparent');
    const traceState = request.headers.get('tracestate');
    
    let activeContext = context.active();
    if (traceParent) {
      const contextFromHeaders = {
        traceparent: traceParent,
        tracestate: traceState || '',
      };
    }
    
    return {};
  })
  .onBeforeHandle(({ request, set, path, store, tracer, metrics }) => {
    if (!store.telemetryEnabled || !tracer) return;
    
    const span = tracer.startSpan(`${request.method} ${path}`, {
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'http.target': path,
        'http.host': request.headers.get('host') || '',
        'http.scheme': new URL(request.url).protocol.replace(':', ''),
        'http.user_agent': request.headers.get('user-agent') || '',
      },
    });
    
    set.span = span;
    set.startTime = Date.now();
    
    metrics.httpRequestTotal.add(1, {
      method: request.method,
      path,
    });
  })
  .onAfterHandle(({ set, path, request, store, metrics }) => {
    if (!store.telemetryEnabled) return;
    
    const span = set.span;
    if (!span) return;
    
    const duration = Date.now() - (set.startTime || Date.now());
    
    span.setAttributes({
      'http.status_code': set.status || 200,
      'http.response_time': duration,
    });
    
    const status = set.status || 200;
    if (status >= 400) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }
    
    metrics.httpRequestDuration.record(duration, {
      method: request.method,
      path,
      status_code: status.toString(),
    });
    
    span.end();
  })
  .onError(({ error, set, path, request, store, metrics }) => {
    if (!store.telemetryEnabled) return;
    
    const span = set.span;
    if (!span) return;
    
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    
    metrics.httpRequestTotal.add(1, {
      method: request.method,
      path,
      status: 'error',
    });
    
    span.end();
  });