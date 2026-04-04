import { log } from '@template/shared/logger';
import { resolveFromAddress } from '#/appEvents/services/email/resolveFromAddress';
import { resolveTargetsToAddresses } from '#/appEvents/services/email/resolveTargets';
import type { AppEventPayload, EmailHandoff } from '#/appEvents/types';
import { enqueueJob } from '#/jobs/enqueue';

const buildTags = (event: AppEventPayload, handoff: EmailHandoff): string[] => [
  event.name,
  handoff.template,
  ...(handoff.tags ?? []),
];

const deliverHandoff = async (event: AppEventPayload, handoff: EmailHandoff): Promise<void> => {
  const [to, cc, bcc, from] = await Promise.all([
    resolveTargetsToAddresses(handoff.to),
    handoff.cc?.length ? resolveTargetsToAddresses(handoff.cc) : undefined,
    handoff.bcc?.length ? resolveTargetsToAddresses(handoff.bcc) : undefined,
    resolveFromAddress(handoff.sender ?? {}, handoff),
  ]);

  if (!to.length) return;

  const job = await enqueueJob('sendEmail', {
    to,
    cc,
    bcc,
    from,
    template: handoff.template,
    data: handoff.data,
    tags: buildTags(event, handoff),
  });

  log.info(`Email bridge: ${event.name} → ${handoff.template} to=${to.length} job=${job.jobId}`);
};

export const deliverEmailHandoffs = async (
  event: AppEventPayload,
  handoffs: EmailHandoff[],
): Promise<void> => {
  await Promise.all(handoffs.map((handoff) => deliverHandoff(event, handoff)));
};
