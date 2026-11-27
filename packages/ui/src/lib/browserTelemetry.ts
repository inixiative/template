/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { SpanKind, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import { maskLogValue } from '@template/shared/logger/maskLogValue';
import type { BrowserTelemetry } from '@template/shared/telemetry/browserSchema';

let tracer: Tracer | undefined;
let apiOrigin: string | undefined;
let initialized = false;
const reportedErrors = new WeakSet<Error>();
const safeError = (error: unknown) => {
  const value = maskLogValue(error instanceof Error ? error : new Error('Unhandled rejection')) as {
    name: string;
    message: string;
    stack?: string;
  };
  return {
    'error.type': value.name.slice(0, 100),
    'error.message': value.message.slice(0, 1000),
    'error.stack': (value.stack ?? '').slice(0, 4000),
  };
};

export const reportBrowserError = (error: unknown): void => {
  if (!tracer || (error instanceof Error && reportedErrors.has(error))) return;
  if (error instanceof Error) reportedErrors.add(error);
  const span = tracer.startSpan('browser.error', { attributes: safeError(error) });
  span.setStatus({ code: SpanStatusCode.ERROR });
  span.end();
};

export const initializeBrowserTelemetry = async (app: BrowserTelemetry['app']): Promise<void> => {
  if (initialized || import.meta.env.VITE_OTEL_ENABLED !== 'true') return;
  initialized = true;
  try {
    const { BasicTracerProvider, BatchSpanProcessor, TraceIdRatioBasedSampler } = await import(
      '@opentelemetry/sdk-trace-base'
    );
    const { makeBrowserSpanExporter } = await import('@template/ui/lib/makeBrowserSpanExporter');
    apiOrigin = new URL(import.meta.env.VITE_API_URL || 'http://localhost:8000').origin;
    const endpoint = `${apiOrigin}/api/telemetry/browser`;
    const ratio = Number(import.meta.env.VITE_OTEL_SAMPLE_RATIO ?? '1');
    const provider = new BasicTracerProvider({
      sampler: new TraceIdRatioBasedSampler(
        Number.isFinite(ratio) && ratio >= 0 && ratio <= 1 ? ratio : 1,
      ),
      spanProcessors: [
        new BatchSpanProcessor(
          makeBrowserSpanExporter({
            app,
            endpoint,
            onExportsStopped: () => {
              tracer = undefined;
            },
          }),
          {
            maxQueueSize: 100,
            maxExportBatchSize: 10,
            scheduledDelayMillis: 3000,
            exportTimeoutMillis: 6000,
          },
        ),
      ],
    });
    tracer = provider.getTracer('template.browser');
    window.addEventListener('error', (event) => reportBrowserError(event.error));
    window.addEventListener('unhandledrejection', (event) => reportBrowserError(event.reason));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void provider.forceFlush().catch(() => {});
    });
    const reportNavigation = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
      const span = tracer?.startSpan('page.load', { startTime: new Date(performance.timeOrigin) });
      span?.end(new Date(performance.timeOrigin + (navigation?.loadEventEnd || performance.now())));
    };
    if (document.readyState === 'complete') reportNavigation();
    else window.addEventListener('load', () => setTimeout(reportNavigation, 0), { once: true });
  } catch {
    initialized = false;
  }
};

export const telemetryFetch = async (request: Request, route?: string): Promise<Response> => {
  if (!tracer || new URL(request.url).origin !== apiOrigin) return fetch(request);
  const method = request.method;
  const span = tracer.startSpan('api.request', {
    kind: SpanKind.CLIENT,
    attributes: {
      'http.request.method': method,
      ...(route && /^\/[A-Za-z0-9_/:{}.-]{0,199}$/.test(route) ? { 'http.route': route } : {}),
    },
  });
  const context = span.spanContext();
  request.headers.set(
    'traceparent',
    `00-${context.traceId}-${context.spanId}-${context.traceFlags.toString(16).padStart(2, '0')}`,
  );
  try {
    const response = await fetch(request);
    span.setAttribute('http.response.status_code', response.status);
    if (response.status >= 400) span.setStatus({ code: SpanStatusCode.ERROR });
    return response;
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.setAttributes(safeError(error));
    throw error;
  } finally {
    span.end();
  }
};
