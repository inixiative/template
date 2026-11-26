/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { SpanStatusCode } from '@opentelemetry/api';
import { ExportResultCode, hrTimeToMilliseconds } from '@opentelemetry/core';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { BrowserTelemetry } from '@template/shared/telemetry/browserSchema';

const maxConsecutiveExportFailures = 3;

type BrowserSpanExporterOptions = {
  app: BrowserTelemetry['app'];
  endpoint: string;
  onExportsStopped: () => void;
};

export const makeBrowserSpanExporter = ({
  app,
  endpoint,
  onExportsStopped,
}: BrowserSpanExporterOptions): SpanExporter => {
  let consecutiveExportFailures = 0;
  const exportsStopped = () => consecutiveExportFailures >= maxConsecutiveExportFailures;

  return {
    export(spans, callback) {
      if (exportsStopped()) return callback({ code: ExportResultCode.FAILED });
      const settleExport = (succeeded: boolean) => {
        consecutiveExportFailures = succeeded ? 0 : consecutiveExportFailures + 1;
        if (exportsStopped()) onExportsStopped();
        callback({ code: succeeded ? ExportResultCode.SUCCESS : ExportResultCode.FAILED });
      };
      const data: BrowserTelemetry = {
        app,
        spans: spans.map((span) => ({
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          name: span.name as BrowserTelemetry['spans'][number]['name'],
          startTimeMs: hrTimeToMilliseconds(span.startTime),
          durationMs: Math.min(hrTimeToMilliseconds(span.duration), 600_000),
          error: span.status.code === SpanStatusCode.ERROR,
          method: span.attributes[
            'http.request.method'
          ] as BrowserTelemetry['spans'][number]['method'],
          status: span.attributes['http.response.status_code'] as number | undefined,
          route: span.attributes['http.route'] as string | undefined,
          errorType: span.attributes['error.type'] as string | undefined,
          errorMessage: span.attributes['error.message'] as string | undefined,
          errorStack: span.attributes['error.stack'] as string | undefined,
        })),
      };
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'omit',
        keepalive: true,
        signal: AbortSignal.timeout(5000),
      })
        .then((response) => settleExport(response.ok))
        .catch(() => settleExport(false));
    },
    async shutdown() {},
  };
};
