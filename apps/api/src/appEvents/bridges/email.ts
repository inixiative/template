import { log } from '@template/shared/logger';
import type { AppEventPayload, EmailHandoff } from '#/appEvents/types';
import { enqueueJob } from '#/jobs/enqueue';

export const deliverEmailHandoffs = async (
  event: AppEventPayload,
  handoffs: EmailHandoff[],
): Promise<void> => {
  await Promise.all(
    handoffs.map(async (handoff) => {
      const tags = [event.name, handoff.template, ...(handoff.tags ?? [])];

      const job = await enqueueJob('sendEmail', { ...handoff, tags });

      log.info(`Email bridge: ${event.name} → ${handoff.template} job=${job.jobId}`);
    }),
  );
};
