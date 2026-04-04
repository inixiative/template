import { log } from '@template/shared/logger';
import { resolveFromAddress } from '#/appEvents/services/email/resolveFromAddress';
import { resolveTargets, resolveTargetsToAddresses } from '#/appEvents/services/email/resolveTargets';
import type { AppEventPayload, EmailHandoff } from '#/appEvents/types';
import { enqueueJob } from '#/jobs/enqueue';

const buildTags = (event: AppEventPayload, handoff: EmailHandoff): string[] => [
  event.name,
  handoff.template,
  ...(handoff.tags ?? []),
];

const deliverHandoff = async (event: AppEventPayload, handoff: EmailHandoff): Promise<void> => {
  const from = await resolveFromAddress(handoff.sender ?? {}, handoff);
  const tags = buildTags(event, handoff);

  const resolved = await resolveTargets(handoff.to);
  const cc = handoff.cc?.length ? await resolveTargetsToAddresses(handoff.cc) : undefined;
  const bcc = handoff.bcc?.length ? await resolveTargetsToAddresses(handoff.bcc) : undefined;

  const deliveries = resolved.map((r) => ({
    to: [r.to],
    cc,
    bcc,
    name: r.name,
  }));

  if (!deliveries.length) return;

  const job = await enqueueJob('sendEmail', { deliveries, from, template: handoff.template, data: handoff.data, tags });

  log.info(`Email bridge: ${event.name} → ${handoff.template} deliveries=${deliveries.length} job=${job.jobId}`);
};

export const deliverEmailHandoffs = async (
  event: AppEventPayload,
  handoffs: EmailHandoff[],
): Promise<void> => {
  await Promise.all(handoffs.map((handoff) => deliverHandoff(event, handoff)));
};
