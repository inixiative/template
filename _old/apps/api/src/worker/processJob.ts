import { Job } from 'bullmq';
import type { JobData } from 'src/plugins/queue';
import { context, SpanStatusCode } from '@opentelemetry/api';

const jobHandlers: Record<string, (payload: any) => Promise<void>> = {
  email: async (payload) => {
    console.log('Sending email:', payload);
  },
  
  notification: async (payload) => {
    console.log('Sending notification:', payload);
  },
  
  report: async (payload) => {
    console.log('Generating report:', payload);
  }
};

export const processJob = (telemetryContext: any) => async (job: Job<JobData>) => {
  const { tracer, metrics, store } = telemetryContext;
  
  if (!store?.telemetryEnabled || !tracer) {
    return executeJob(job);
  }

  const span = tracer.startSpan(`job.${job.data.type}`, {
    attributes: {
      'job.id': job.id,
      'job.type': job.data.type,
      'job.queue': job.queueName,
      'job.attempt': job.attemptsMade + 1,
    }
  });

  const startTime = Date.now();

  return context.with(context.active(), async () => {
    try {
      await executeJob(job);
      
      const duration = Date.now() - startTime;
      
      metrics.jobProcessingDuration?.record(duration, {
        type: job.data.type,
        status: 'success'
      });
      
      metrics.jobProcessedTotal?.add(1, {
        type: job.data.type,
        status: 'success'
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error);
      span.setStatus({ 
        code: SpanStatusCode.ERROR,
        message: error.message 
      });
      
      metrics.jobProcessedTotal?.add(1, {
        type: job.data.type,
        status: 'failed'
      });
      
      throw error;
    } finally {
      span.end();
    }
  });
};

const executeJob = async (job: Job<JobData>) => {
  console.log(`Processing job ${job.id} of type ${job.data.type}`);
  
  const handler = jobHandlers[job.data.type];
  if (!handler) throw new Error(`Unknown job type: ${job.data.type}`);
  
  await handler(job.data.payload);
};