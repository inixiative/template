import { log } from '@template/shared/logger';
import { resolveFromAddress } from '#/appEvents/services/email/resolveFromAddress';
import { resolveTargets, resolveTargetsToAddresses } from '#/appEvents/services/email/resolveTargets';
import type { AppEventPayload, EmailHandoff } from '#/appEvents/types';
import { enqueueJob } from '#/jobs/enqueue';

const deliverHandoff = async (event: AppEventPayload, handoff: EmailHandoff): Promise<void> => {
  const ctx = { userId: event.actor.actorUserId ?? undefined, ...handoff.context };
  const from = await resolveFromAddress(ctx, handoff);

  if (handoff.group) {
    const [to, cc, bcc] = await Promise.all([
      resolveTargetsToAddresses(handoff.group.to),
      handoff.group.cc ? resolveTargetsToAddresses(handoff.group.cc) : [],
      handoff.group.bcc ? resolveTargetsToAddresses(handoff.group.bcc) : [],
    ]);

    if (!to.length) return;

    const job = await enqueueJob('sendEmail', {
      recipients: to.map((email) => ({ to: email, name: '' })),
      cc,
      bcc,
      from,
      template: handoff.message.template,
      data: handoff.message.data,
      tags: handoff.tags,
      category: handoff.category,
      emailContext: ctx,
    });

    log.info(`Email bridge: ${event.name} → ${handoff.message.template} group to=${to.length} cc=${cc.length} bcc=${bcc.length} job=${job.jobId}`);
  } else {
    const recipients = await resolveTargets(handoff.target);

    if (!recipients.length) return;

    const job = await enqueueJob('sendEmail', {
      recipients,
      from,
      template: handoff.message.template,
      data: handoff.message.data,
      tags: handoff.tags,
      category: handoff.category,
      emailContext: ctx,
    });

    log.info(`Email bridge: ${event.name} → ${handoff.message.template} recipients=${recipients.length} job=${job.jobId}`);
  }
};

export const deliverEmailHandoffs = async (
  event: AppEventPayload,
  handoffs: EmailHandoff[],
): Promise<void> => {
  await Promise.all(handoffs.map((handoff) => deliverHandoff(event, handoff)));
};
