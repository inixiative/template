/**
 * @atlas
 * @kind handler, channel
 * @partOf primitive:appEvents
 * @uses primitive:jobs
 */
import { log } from '@template/shared/logger';
import type { AppEventPayload, EmailHandoff } from '#/appEvents/types';
import { enqueueJob } from '#/jobs/enqueue';
import { plannerJobId } from '#/lib/email/idempotency';

export const deliverEmailHandoffs = async (event: AppEventPayload, handoffs: EmailHandoff[]): Promise<void> => {
  await Promise.all(
    handoffs.map(async (handoff) => {
      const job = await enqueueJob(
        'sendEmail',
        { ...handoff, eventName: event.name },
        { id: plannerJobId(event.name, handoff.template, event.data) },
      );

      log.info(`Email channel: ${event.name} → ${handoff.template} job=${job.jobId}`);
    }),
  );
};
