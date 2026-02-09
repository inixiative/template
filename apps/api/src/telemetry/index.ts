import packageJson from "../../package.json" with { type: "json" };
import { isLocal, isTest } from "@template/shared";
import { log as sharedLogger } from "@template/shared/logger";
import { SeverityNumber } from "@opentelemetry/api-logs";
import type { LogType } from "consola";

const serviceName = packageJson.name;
const serviceVersion = packageJson.version;
const environment = process.env.ENVIRONMENT || 'local';

const ConsolaLogTypeToOTELSeverity: Record<LogType, SeverityNumber> = {
  log: SeverityNumber.INFO,
  box: SeverityNumber.INFO,
  start: SeverityNumber.INFO,
  info: SeverityNumber.INFO,
  ready: SeverityNumber.INFO,
  success: SeverityNumber.INFO,
  fatal: SeverityNumber.FATAL,
  error: SeverityNumber.ERROR,
  fail: SeverityNumber.ERROR,
  warn: SeverityNumber.WARN,
  debug: SeverityNumber.DEBUG,
  silent: SeverityNumber.DEBUG,
  verbose: SeverityNumber.DEBUG,
  trace: SeverityNumber.TRACE,
}

export const initTelemetry = async () => {
  if (isLocal || isTest) {
    console.log('🔍 OpenTelemetry disabled in local and test ⛔');
    return;
  }

  if (!process.env.OTEL_ENABLED) {
    console.log('🔍 OpenTelemetry disabled by configuration ⛔');
    return;
  }

  // Dynamic imports to avoid loading OTel in local/test
  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { resourceFromAttributes } = await import( '@opentelemetry/resources');
  const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import(  '@opentelemetry/semantic-conventions');

  const { OTLPLogExporter } = await import('@opentelemetry/exporter-logs-otlp-proto');
  const { BatchLogRecordProcessor, LoggerProvider } = await import('@opentelemetry/sdk-logs');

  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-proto');
  const { BatchSpanProcessor } = await import('@opentelemetry/sdk-trace-base');

  const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-proto');
  const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');

  const { PrismaInstrumentation } = await import('@prisma/instrumentation');
  const { IORedisInstrumentation } = await import('@opentelemetry/instrumentation-ioredis');

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    environment,
  })

  const logRecordProcessors = [new BatchLogRecordProcessor(
    new OTLPLogExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT, // defaults to localhost
      headers: process.env.OTEL_EXPORTER_TOKEN ? {
        Authorization: `Bearer ${process.env.OTEL_EXPORTER_TOKEN}`,
      } : undefined,
    })),
  ]

  const otelSDK = new NodeSDK({
    resource,
    logRecordProcessors,
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT, // defaults to localhost
      headers: process.env.OTEL_EXPORTER_TOKEN ? {
        Authorization: `Bearer ${process.env.OTEL_EXPORTER_TOKEN}`,
      } : undefined,
    }))],
    metricReaders: [new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT, // defaults to localhost
        headers: process.env.OTEL_EXPORTER_TOKEN ? {
          Authorization: `Bearer ${process.env.OTEL_EXPORTER_TOKEN}`,
        } : undefined,
      }),
      exportIntervalMillis: 10000,
    })],
    // Only include specific instrumentations that work well with Bun
    instrumentations: [
      new PrismaInstrumentation({
        // ignoreSpanTypes: reduce clutter
      }),
      new IORedisInstrumentation({
        // requireParentSpan: true, // Require parent to create ioredis span, default when unset is true
      }),
    ],
  });

  // TODO(hmassad): more metrics: cache hits/misses, job duration/count/total/queue size

  try {
    otelSDK.start();
    console.log('🔍 OpenTelemetry initialized');

    // Graceful shutdown
    process.on('SIGTERM', otelSDK.shutdown);
    process.on('SIGINT', otelSDK.shutdown);

    // configure consola to send logs to opentelemetry
    sharedLogger.addReporter({
      log(logObject) {
        const loggerProvider = new LoggerProvider({
          resource,
          processors: logRecordProcessors,
        });
        const logger = loggerProvider.getLogger("default")

        logger.emit({
          severityNumber: ConsolaLogTypeToOTELSeverity[logObject.type] ?? SeverityNumber.INFO,
          severityText: logObject.type,
          body: logObject.args.join(' '),
          attributes: {
            'consola.tag': logObject.tag,
          },
        });
      }
    })
  } catch (error) {
    console.error('Error initializing OpenTelemetry', error);
  }
};
