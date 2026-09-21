/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { log, withLogContext } from '@template/shared/logger';
import { recordDuration, SpanKind, withRemoteTrace, withSpan } from '@template/shared/telemetry';

export const traceJob = <T>(
  job: { name: string; id?: string; attemptsMade: number; data: { traceContext?: Record<string, string> } },
  run: () => Promise<T>,
): Promise<T> =>
  withRemoteTrace(job.data.traceContext, () =>
    withLogContext({ jobId: job.id, jobName: job.name, attempt: job.attemptsMade + 1 }, () =>
      withSpan(
        `${job.name} process`,
        {
          kind: SpanKind.CONSUMER,
          attributes: {
            'messaging.system': 'redis',
            'messaging.destination.name': 'jobs',
            'messaging.operation.type': 'process',
            'job.name': job.name,
            'job.attempt': job.attemptsMade + 1,
            ...(job.id ? { 'messaging.message.id': job.id } : {}),
          },
        },
        async () => {
          const start = performance.now();
          let outcome = 'success';
          try {
            return await run();
          } catch (error) {
            outcome = 'error';
            log.error({ err: error }, 'Job attempt failed');
            throw error;
          } finally {
            recordDuration('job.processing.duration', (performance.now() - start) / 1000, {
              'job.name': job.name,
              outcome,
            });
          }
        },
      ),
    ),
  );
