import { db } from '@template/db';
import { log } from '@template/shared/logger';
import { resolveFromAddress } from '#/appEvents/bridges/resolveFromAddress';
import type { AppEventPayload, EmailContext, EmailHandoff } from '#/appEvents/types';
import { enqueueJob } from '#/jobs/enqueue';

type Recipient = { to: string; name: string };

const resolveSenderVars = (): Record<string, unknown> => ({
  platformName: process.env.PLATFORM_NAME ?? 'Template',
  address: process.env.PLATFORM_ADDRESS ?? '',
});

const resolveUserIds = async (userIds: string[]): Promise<Recipient[]> => {
  if (!userIds.length) return [];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { email: true, name: true },
  });
  return users
    .filter((u): u is typeof u & { email: string } => !!u.email)
    .map((u) => ({ to: u.email, name: u.name ?? '' }));
};

const resolveAddressList = async (
  spec: { userIds?: string[]; raw?: string[] } | undefined,
): Promise<string[]> => {
  if (!spec) return [];
  const fromUsers = spec.userIds ? (await resolveUserIds(spec.userIds)).map((r) => r.to) : [];
  const fromRaw = spec.raw ?? [];
  return [...fromUsers, ...fromRaw];
};

const isGroupTarget = (
  target: EmailHandoff['target'],
): target is { to: { userIds?: string[]; raw?: string[] }; cc?: { userIds?: string[]; raw?: string[] }; bcc?: { userIds?: string[]; raw?: string[] } } => {
  return 'to' in target && typeof target.to === 'object' && !Array.isArray(target.to);
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
      const from = await resolveFromAddress(ctx, handoff);
      const senderVars = resolveSenderVars();

      if (isGroupTarget(handoff.target)) {
        const [to, cc, bcc] = await Promise.all([
          resolveAddressList(handoff.target.to),
          resolveAddressList(handoff.target.cc),
          resolveAddressList(handoff.target.bcc),
        ]);

        if (!to.length) {
          log.debug(`Email bridge: no recipients for event=${event.type} template=${handoff.message.template}`);
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
          `Email bridge: event=${event.type} template=${handoff.message.template} group to=${to.length} cc=${cc.length} bcc=${bcc.length} job=${job.jobId}`,
        );
      } else {
        const recipients =
          'raw' in handoff.target
            ? handoff.target.raw.map((email) => ({ to: email, name: '' }))
            : await resolveUserIds(handoff.target.userIds);

        if (!recipients.length) {
          log.debug(`Email bridge: no recipients for event=${event.type} template=${handoff.message.template}`);
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
          `Email bridge: event=${event.type} template=${handoff.message.template} recipients=${recipients.length} job=${job.jobId}`,
        );
      }
    } catch (err) {
      log.error(`Email bridge failed for event=${event.type} template=${handoff.message.template}`, { error: err });
    }
  }
};
