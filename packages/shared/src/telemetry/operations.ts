/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import {
  type Attributes,
  context,
  metrics,
  propagation,
  ROOT_CONTEXT,
  type Span,
  type SpanOptions,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';

export const withSpan = async <T>(
  name: string,
  options: SpanOptions,
  operation: (span: Span) => Promise<T>,
): Promise<T> =>
  trace.getTracer('template').startActiveSpan(name, options, async (span) => {
    try {
      return await operation(span);
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttribute('error.type', error instanceof Error ? error.name : 'UnknownError');
      throw error;
    } finally {
      span.end();
    }
  });

export const captureTraceContext = (): Record<string, string> => {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
};
export const withRemoteTrace = <T>(carrier: Record<string, string> | undefined, fn: () => T): T =>
  context.with(propagation.extract(ROOT_CONTEXT, carrier ?? {}), fn);

export const recordDuration = (name: string, seconds: number, attributes: Attributes): void =>
  metrics
    .getMeter('template')
    .createHistogram(name, {
      unit: 's',
      advice: {
        explicitBucketBoundaries: [
          0, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10, 30, 60, 300, 600,
        ],
      },
    })
    .record(seconds, attributes);
export { context, metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
