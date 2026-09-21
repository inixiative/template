/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { log, withLogContext } from '../../packages/shared/src/logger';
import { captureTraceContext, recordDuration, withRemoteTrace, withSpan } from '../../packages/shared/src/telemetry';
import { readTelemetryConfig } from '../../packages/shared/src/telemetry/config';
import { initializeTelemetry } from '../../packages/shared/src/telemetry/initialize';

const config = readTelemetryConfig('api');
if (!config) throw new Error('Set OTEL_ENABLED=true and OTEL_EXPORTER_OTLP_ENDPOINT to your collector');
const sdk = initializeTelemetry(config);
log.level = 'info';
let traceId = '';
try {
  await withLogContext({ requestId: 'monitoring-smoke' }, () =>
    withSpan('monitoring.smoke', {}, async (span) => {
      traceId = span.spanContext().traceId;
      log.info(
        { event: 'monitoring.smoke', component: 'smoke', nested: { password: 'must-be-redacted' } },
        'Structured logging is working',
      );
      const carrier = JSON.parse(JSON.stringify(captureTraceContext()));
      await withRemoteTrace(carrier, () =>
        withSpan('monitoring.worker', {}, async () => {
          log.info({ jobId: 'smoke-job' }, 'Worker shares the request trace');
          recordDuration('monitoring.smoke.duration', 0.01, { outcome: 'success' });
        }),
      );
    }),
  );
  await sdk.forceFlush();
  console.log(`Exported smoke data. Search trace ID: ${traceId}`);
} finally {
  await sdk.shutdown();
}
