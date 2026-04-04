import { log } from '@template/shared/logger';
import { resolveFromAddress } from '#/appEvents/services/email/resolveFromAddress';
import { resolveTargets, resolveTargetsToAddresses } from '#/appEvents/services/email/resolveTargets';
import type { AppEventPayload, EmailHandoff } from '#/appEvents/types';
import { enqueueJob } from '#/jobs/enqueue';

const deliverHandoff = async (event: AppEventPayload, handoff: EmailHandoff): Promise<void> => {
  const from = await resolveFromAddress(handoff.sender ?? {}, handoff);
  const isGroup = handoff.cc?.length || handoff.bcc?.length;

  if (isGroup) {
    const [to, cc, bcc] = await Promise.all([
      resolveTargetsToAddresses(handoff.to),
      handoff.cc ? resolveTargetsToAddresses(handoff.cc) : [],
      handoff.bcc ? resolveTargetsToAddresses(handoff.bcc) : [],
    ]);

    if (!to.length) return;

    const job = await enqueueJob('sendEmail', {
      recipients: to.map((email) => ({ to: email, name: '' })),
      cc,
      bcc,
      from,
      template: handoff.template,
      data: handoff.data,
      eventName: event.name,
    });

    log.info(`Email bridge: ${event.name} → ${handoff.template} group to=${to.length} cc=${cc.length} bcc=${bcc.length} job=${job.jobId}`);
  } else {
    const recipients = await resolveTargets(handoff.to);

    if (!recipients.length) return;

    const job = await enqueueJob('sendEmail', {
      recipients,
      from,
      template: handoff.template,
      data: handoff.data,
      eventName: event.name,
    });

    log.info(`Email bridge: ${event.name} → ${handoff.template} recipients=${recipients.length} job=${job.jobId}`);
  }
};

export const deliverEmailHandoffs = async (
  event: AppEventPayload,
  handoffs: EmailHandoff[],
): Promise<void> => {
  await Promise.all(handoffs.map((handoff) => deliverHandoff(event, handoff)));
};
