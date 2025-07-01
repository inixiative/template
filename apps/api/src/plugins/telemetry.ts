import { Elysia } from 'elysia';
import { trace } from '@opentelemetry/api';
import { metricsClient } from 'src/telemetry';

const tracer = trace.getTracer('app', '1.0.0');

export const telemetry = new Elysia({ name: 'telemetry' })
  .state('telemetryEnabled', process.env.OTEL_ENABLED === 'true')
  .decorate('tracer', tracer)
  .decorate('metrics', metricsClient)
  .derive(({ store }) => {
    if (!store.telemetryEnabled) return { 
      tracer: null,
      startSpan: () => null,
    };
    
    return {
      tracer,
      startSpan: (name: string, attributes?: Record<string, any>) => 
        tracer.startSpan(name, { attributes }),
    };
  })
  .as('plugin');