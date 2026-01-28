import { trace, metrics, context, propagation } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';

const environment = process.env.ENVIRONMENT || 'local';
const serviceName = 'api';
const serviceVersion = '1.0.0';

// Configure trace exporter
const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
});

// Configure metric exporter
const metricExporter = new OTLPMetricExporter({
  url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics',
});

// Create SDK with minimal auto-instrumentation for Bun compatibility
export const otelSDK = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    environment,
  }),
  spanProcessor: new BatchSpanProcessor(traceExporter),
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 10000,
  }),
  instrumentations: [
    // Only include specific instrumentations that work well with Bun
    new IORedisInstrumentation(),
  ],
});

// Helper to create spans manually for Elysia
export const createSpan = (name: string, fn: () => any) => {
  const tracer = trace.getTracer(serviceName, serviceVersion);
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: 1 });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error?.toString() });
      throw error;
    } finally {
      span.end();
    }
  });
};

// Metrics helpers
export const metricsClient = {
  httpRequestDuration: metrics.getMeter(serviceName).createHistogram('http_request_duration', {
    description: 'Duration of HTTP requests in milliseconds',
    unit: 'ms',
  }),
  
  httpRequestTotal: metrics.getMeter(serviceName).createCounter('http_request_total', {
    description: 'Total number of HTTP requests',
  }),
  
  dbQueryDuration: metrics.getMeter(serviceName).createHistogram('db_query_duration', {
    description: 'Duration of database queries in milliseconds',
    unit: 'ms',
  }),
  
  cacheHits: metrics.getMeter(serviceName).createCounter('cache_hits_total', {
    description: 'Total number of cache hits',
  }),
  
  cacheMisses: metrics.getMeter(serviceName).createCounter('cache_misses_total', {
    description: 'Total number of cache misses',
  }),
  
  jobProcessingDuration: metrics.getMeter(serviceName).createHistogram('job_processing_duration', {
    description: 'Duration of job processing in milliseconds',
    unit: 'ms',
  }),
  
  jobProcessedTotal: metrics.getMeter(serviceName).createCounter('job_processed_total', {
    description: 'Total number of jobs processed',
  }),
  
  queueSize: metrics.getMeter(serviceName).createUpDownCounter('queue_size', {
    description: 'Current size of the queue',
  }),
};

// Initialize telemetry
export const initTelemetry = async () => {
  if (!process.env.OTEL_ENABLED) {
    console.log('🔍 OpenTelemetry disabled');
    return;
  }

  try {
    await otelSDK.start();
    console.log('🔍 OpenTelemetry initialized');
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      await otelSDK.shutdown();
    });
  } catch (error) {
    console.error('Error initializing OpenTelemetry', error);
  }
};

// Context propagation helpers
export const extractContext = (headers: Record<string, string>) => {
  return propagation.extract(context.active(), headers);
};

export const injectContext = (headers: Record<string, string>) => {
  propagation.inject(context.active(), headers);
  return headers;
};