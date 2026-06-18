/**
 * @atlas
 * @kind handler, bridge
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
      const tags = [event.name, handoff.template];

      const job = await enqueueJob(
        'sendEmail',
        { ...handoff, eventName: event.name, tags },
        { id: plannerJobId(event.name, handoff.template, event.data) },
      );

      log.info(`Email bridge: ${event.name} → ${handoff.template} job=${job.jobId}`);
    }),
  );
};
