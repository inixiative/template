/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { JsonLogsSerializer, JsonMetricsSerializer, JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { AggregationTemporality, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { observeLogRecords } from '@template/shared/logger/records';
import { stringifyLogValue } from '@template/shared/logger/redact';
import { signalExportOptions, type TelemetryConfig } from '@template/shared/telemetry/config';
import { createFetchExporter } from '@template/shared/telemetry/fetchExporter';

let instance: ReturnType<typeof startTelemetry> | undefined;
const startTelemetry = (config: TelemetryConfig) => {
  const resource = resourceFromAttributes({
    'service.name': config.serviceName,
    'service.version': config.serviceVersion,
    'deployment.environment.name': config.environment,
    'service.instance.id': crypto.randomUUID(),
    'service.role': config.role,
  });
  const targets = {
    traces: signalExportOptions('traces', config.endpoint, config.headers),
    metrics: signalExportOptions('metrics', config.endpoint, config.headers),
    logs: signalExportOptions('logs', config.endpoint, config.headers),
  };
  const tracer = new BasicTracerProvider({
    resource,
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(config.sampleRatio) }),
    spanLimits: { attributeValueLengthLimit: 4096, attributeCountLimit: 64 },
    spanProcessors: [
      new BatchSpanProcessor(
        createFetchExporter({ ...targets.traces, serialize: JsonTraceSerializer.serializeRequest }),
        { maxQueueSize: 2048, maxExportBatchSize: 32 },
      ),
    ],
  });
  const meter = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: {
          ...createFetchExporter({ ...targets.metrics, serialize: JsonMetricsSerializer.serializeRequest }),
          selectAggregationTemporality: () => AggregationTemporality.DELTA,
        },
        exportIntervalMillis: 30_000,
        exportTimeoutMillis: 10_000,
      }),
    ],
  });
  const logger = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor(
        createFetchExporter({ ...targets.logs, serialize: JsonLogsSerializer.serializeRequest }),
        { maxQueueSize: 2048, maxExportBatchSize: 32 },
      ),
    ],
  });
  const contextManager = new AsyncLocalStorageContextManager().enable();
  context.setGlobalContextManager(contextManager);
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(tracer);
  metrics.setGlobalMeterProvider(meter);
  logs.setGlobalLoggerProvider(logger);
  const severity = {
    trace: SeverityNumber.TRACE,
    debug: SeverityNumber.DEBUG,
    info: SeverityNumber.INFO,
    success: SeverityNumber.INFO,
    box: SeverityNumber.INFO,
    warn: SeverityNumber.WARN,
    error: SeverityNumber.ERROR,
    fatal: SeverityNumber.FATAL,
  };
  const stopLogs = observeLogRecords((record) =>
    logger.getLogger('template').emit({
      body: record.message,
      timestamp: record.timestamp,
      severityText: record.level,
      severityNumber: severity[record.level],
      context: context.active(),
      attributes: Object.fromEntries(
        Object.entries(record.fields).map(([key, value]) => [
          key,
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? value
            : stringifyLogValue(value),
        ]),
      ),
    }),
  );
  const runtime = meter.getMeter('template.runtime');
  runtime
    .createObservableGauge('process.memory.usage', { unit: 'By' })
    .addCallback((result) => result.observe(process.memoryUsage().rss));
  runtime
    .createObservableGauge('process.runtime.heap.usage', { unit: 'By' })
    .addCallback((result) => result.observe(process.memoryUsage().heapUsed));
  runtime.createObservableCounter('process.cpu.time', { unit: 's' }).addCallback((result) => {
    const cpu = process.cpuUsage();
    result.observe(cpu.user / 1_000_000, { 'cpu.mode': 'user' });
    result.observe(cpu.system / 1_000_000, { 'cpu.mode': 'system' });
  });
  return {
    async forceFlush() {
      await Promise.all([tracer.forceFlush(), meter.forceFlush(), logger.forceFlush()]);
    },
    async shutdown() {
      stopLogs();
      await Promise.allSettled([tracer.shutdown(), meter.shutdown(), logger.shutdown()]);
      context.disable();
      propagation.disable();
      trace.disable();
      metrics.disable();
      logs.disable();
      contextManager.disable();
      instance = undefined;
    },
  };
};
export const initializeTelemetry = (config: TelemetryConfig) => {
  instance ??= startTelemetry(config);
  return instance;
};
