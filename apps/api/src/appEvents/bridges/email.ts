import { log } from '@template/shared/logger';
import { resolveFromAddress } from '#/appEvents/services/email/resolveFromAddress';
import { resolveTargets, resolveTargetsToAddresses } from '#/appEvents/services/email/resolveTargets';
import type { AppEventPayload, EmailContext, EmailHandoff } from '#/appEvents/types';
import { enqueueJob } from '#/jobs/enqueue';

const resolveSenderVars = (): Record<string, unknown> => ({
  platformName: process.env.PLATFORM_NAME ?? 'Template',
  address: process.env.PLATFORM_ADDRESS ?? '',
});

const buildEmailContext = (event: AppEventPayload, handoff: EmailHandoff): EmailContext => {
  return {
    userId: event.actor.actorUserId ?? undefined,
    organizationId: undefined,
    spaceId: undefined,
    ...handoff.context,
  };
};

export const deliverEmailHandoffs = async (
  event: AppEventPayload,
  handoffs: EmailHandoff[],
): Promise<void> => {
  for (const handoff of handoffs) {
    try {
      const ctx = buildEmailContext(event, handoff);
      const from = await resolveFromAddress(ctx, handoff);
      const senderVars = resolveSenderVars();
      const isGroup = !!handoff.group;

      if (isGroup) {
        const [to, cc, bcc] = await Promise.all([
          resolveTargetsToAddresses(handoff.group!.to),
          handoff.group!.cc ? resolveTargetsToAddresses(handoff.group!.cc) : [],
          handoff.group!.bcc ? resolveTargetsToAddresses(handoff.group!.bcc) : [],
        ]);

        if (!to.length) {
          log.debug(`Email bridge: no recipients for event=${event.name} template=${handoff.message.template}`);
          continue;
        }

        const job = await enqueueJob('sendEmail', {
          recipients: to.map((email) => ({ to: email, name: '' })),
          cc,
          bcc,
          from,
          template: handoff.message.template,
          data: handoff.message.data,
          senderVars,
          tags: handoff.tags,
          category: handoff.category,
          emailContext: ctx,
        });

        log.info(
          `Email bridge: event=${event.name} template=${handoff.message.template} group to=${to.length} cc=${cc.length} bcc=${bcc.length} job=${job.jobId}`,
        );
      } else {
        const recipients = await resolveTargets(handoff.target);

        if (!recipients.length) {
          log.debug(`Email bridge: no recipients for event=${event.name} template=${handoff.message.template}`);
          continue;
        }

        const job = await enqueueJob('sendEmail', {
          recipients,
          from,
          template: handoff.message.template,
          data: handoff.message.data,
          senderVars,
          tags: handoff.tags,
          category: handoff.category,
          emailContext: ctx,
        });

        log.info(
          `Email bridge: event=${event.name} template=${handoff.message.template} recipients=${recipients.length} job=${job.jobId}`,
        );
      }
    } catch (err) {
      log.error(`Email bridge failed for event=${event.name} template=${handoff.message.template}`, { error: err });
    }
  }
};
