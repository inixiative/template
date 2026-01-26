import { env } from '#/config/env';
import { log } from '#/lib/logger';

/**
 * Initialize OpenTelemetry for BetterStack (or any OTLP-compatible backend).
 *
 * This must be called BEFORE any other imports that you want to trace.
 * Typically import this at the very top of your entry point.
 *
 * Required environment variables:
 * - OTEL_EXPORTER_OTLP_ENDPOINT: The OTLP endpoint (e.g., https://in-otel.logs.betterstack.com)
 * - OTEL_EXPORTER_OTLP_HEADERS: Auth headers (e.g., Authorization=Bearer <token>)
 * - OTEL_SERVICE_NAME: Service name for traces (defaults to 'inixiative-api')
 */
export async function initializeOpenTelemetry() {
  // Skip in local/test environments
  if (env.ENVIRONMENT === 'local' || env.ENVIRONMENT === 'test') {
    log.info('⏭️  Skipping OpenTelemetry initialization (local/test environment)');
    return;
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    log.info('⚠️  OTEL_EXPORTER_OTLP_ENDPOINT not configured, skipping OpenTelemetry initialization');
    return;
  }

  log.info(`🔧 Initializing OpenTelemetry for service: ${process.env.OTEL_SERVICE_NAME || 'inixiative-api'}`);

  try {
    // Dynamic imports to avoid loading OTel in local/test
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { PrismaInstrumentation } = await import('@prisma/instrumentation');

    const traceExporter = new OTLPTraceExporter();
    const metricExporter = new OTLPMetricExporter();

    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 30000, // Export every 30 seconds
    });

    const sdk = new NodeSDK({
      traceExporter,
      metricReader,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable noisy instrumentations
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-net': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
          // Configure HTTP instrumentation
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            ignoreIncomingRequestHook: (request: { url?: string }) => {
              // Ignore health checks from creating spans
              const url = request.url || '';
              return url.includes('/health');
            },
          },
        }),
        // Prisma instrumentation for database traces
        new PrismaInstrumentation(),
      ],
    });

    sdk.start();
    log.info('✅ OpenTelemetry SDK started successfully');
    log.info(`   Endpoint: ${endpoint}`);
  } catch (error) {
    log.error('❌ Failed to initialize OpenTelemetry:', error);
  }
}
