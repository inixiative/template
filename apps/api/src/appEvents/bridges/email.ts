import { db } from '@template/db';
import { log } from '@template/shared/logger';
import { resolveFromAddress } from '#/appEvents/bridges/resolveFromAddress';
import type { AppEventPayload, EmailContext, EmailHandoff } from '#/appEvents/types';
import { enqueueJob } from '#/jobs/enqueue';

type ResolvedRecipient = {
  to: string;
  name: string;
};

const resolveSenderVars = (): Record<string, unknown> => ({
  platformName: process.env.PLATFORM_NAME ?? 'Template',
  address: process.env.PLATFORM_ADDRESS ?? '',
});

const resolveTargets = async (handoff: EmailHandoff): Promise<ResolvedRecipient[]> => {
  if ('raw' in handoff.target) {
    return handoff.target.raw.map((email) => ({ to: email, name: '' }));
  }

  const { userIds } = handoff.target;
  if (!userIds.length) return [];

  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true },
  });

  return users
    .filter((u): u is typeof u & { email: string } => !!u.email)
    .map((u) => ({ to: u.email, name: u.name ?? '' }));
};

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
      const recipients = await resolveTargets(handoff);

      if (!recipients.length) {
        log.debug(`Email bridge: no recipients for event=${event.type} template=${handoff.message.template}`);
        continue;
      }

      const from = await resolveFromAddress(ctx, handoff);

      const job = await enqueueJob('sendEmail', {
        recipients,
        from,
        template: handoff.message.template,
        data: handoff.message.data,
        senderVars: resolveSenderVars(),
        tags: handoff.tags,
        category: handoff.category,
        emailContext: ctx,
      });

      log.info(
        `Email bridge: event=${event.type} template=${handoff.message.template} recipients=${recipients.length} job=${job.jobId}`,
      );
    } catch (err) {
      log.error(`Email bridge failed for event=${event.type} template=${handoff.message.template}`, { error: err });
    }
  }
};
