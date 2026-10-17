/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { log, withLogContext } from '@template/shared/logger';
import { recordDuration, SpanKind, withRemoteTrace, withSpan } from '@template/shared/telemetry';
import { DelayedError, WaitingChildrenError, WaitingError } from 'bullmq';

// The errors BullMQ uses to mean "move this job and come back to it", not "this attempt failed": a
// slow job put back for a slot, or a staged job parking in `waiting-children`.
const isBullmqWaitSignal = (err: unknown): err is Error =>
  err instanceof DelayedError || err instanceof WaitingError || err instanceof WaitingChildrenError;

// A wait signal is caught inside the span and rethrown after it ends, so a parked job's span ends OK
// and is recorded with outcome `waiting` instead of logging as a failed attempt. BullMQ still gets the
// signal it needs.
export const traceJob = async <T>(
  job: {
    name: string;
    id?: string;
    attemptsMade: number;
    data: { traceContext?: Record<string, string> };
  },
  run: () => Promise<T>,
): Promise<T> => {
  let waitSignal: Error | undefined;
  const result = await withRemoteTrace(job.data.traceContext, () =>
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
            if (isBullmqWaitSignal(error)) {
              outcome = 'waiting';
              waitSignal = error;
              return undefined as T;
            }
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
  if (waitSignal) throw waitSignal;
  return result;
};
