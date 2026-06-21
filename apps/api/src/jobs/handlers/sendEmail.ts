/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:email
 */
import type { LensNarrowing } from '@inixiative/json-rules';
import { db, Prisma } from '@template/db';
import { fetchLens } from '@template/db/hydrate';
import { prune } from '@template/db/lens';
import { log } from '@template/shared/logger';
import { enqueueJob } from '#/jobs/enqueue';
import { makeJob } from '#/jobs/makeJob';
import { emailRegistry } from '#/lib/email';
import { deliverJobId, plannerJobId } from '#/lib/email/idempotency';
import { registry } from '#/lib/email/registry';
import type { Sender } from '#/lib/email/sender';

export type SendEmailPayload = {
  eventName: string;
  template: string;
  data: Record<string, unknown>;
};

type Recipient = { id: string; name: string; email: string };

const senderColumns = (sender: Sender) => {
  switch (sender.type) {
    case 'User':
      return { senderType: sender.type, senderUserId: sender.userId, senderOrganizationId: null, senderSpaceId: null };
    case 'Organization':
      return {
        senderType: sender.type,
        senderUserId: null,
        senderOrganizationId: sender.organizationId,
        senderSpaceId: null,
      };
    case 'Space':
      return { senderType: sender.type, senderUserId: null, senderOrganizationId: null, senderSpaceId: sender.spaceId };
    case 'OrganizationUser':
      return {
        senderType: sender.type,
        senderUserId: sender.userId,
        senderOrganizationId: sender.organizationId,
        senderSpaceId: null,
      };
    case 'SpaceUser':
      return {
        senderType: sender.type,
        senderUserId: sender.userId,
        senderOrganizationId: null,
        senderSpaceId: sender.spaceId,
      };
    default:
      return { senderType: sender.type, senderUserId: null, senderOrganizationId: null, senderSpaceId: null };
  }
};

export const sendEmail = makeJob<SendEmailPayload>(async (_ctx, payload) => {
  const { eventName, template, data } = payload;

  const entry = registry[template];
  if (!entry) {
    log.info(`No email registry entry — skipping (template=${template})`);
    return;
  }

  const entityLens = entry.entity(data);
  const [entity] = await fetchLens(db, entityLens);
  if (!entity) return;

  if (!emailRegistry.names().length) {
    log.info(`No email adapter registered — skipping (template=${template})`);
    return;
  }

  const dataVars = entry.data ? entry.data(entity, data) : (prune(entity, entityLens) as Record<string, unknown>);

  const emailsOf = async (lens: LensNarrowing): Promise<string[] | undefined> => {
    const rows = await fetchLens(db, lens);
    if (!rows.length) return undefined;
    return (prune(rows, lens) as Array<{ email: string }>).map((r) => r.email);
  };

  const sender = entry.sender(entity);
  const recipientLens = entry.recipients(entity, sender);
  const sendKey = plannerJobId(eventName, template, data);

  let fanned = 0;
  for (const user of await fetchLens(db, recipientLens)) {
    const recipient = prune(user, recipientLens) as Recipient;
    const cc = entry.cc ? await emailsOf(entry.cc(user, sender)) : undefined;
    const bcc = entry.bcc ? await emailsOf(entry.bcc(user, sender)) : undefined;

    const idempotencyKey = deliverJobId(eventName, template, sender, recipient.email, dataVars);
    const contact = await db.contact.findFirst({
      where: { userId: recipient.id, type: 'email', deletedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

    let communicationLogId: string;
    try {
      const row = await db.communicationLog.upsert({
        where: { idempotencyKey },
        create: {
          channel: 'email',
          sendKey,
          idempotencyKey,
          address: recipient.email,
          recipientUserId: recipient.id,
          recipientContactId: contact?.id ?? null,
          ...senderColumns(sender),
        },
        update: {},
        select: { id: true },
      });
      communicationLogId = row.id;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      const existing = await db.communicationLog.findUniqueOrThrow({ where: { idempotencyKey }, select: { id: true } });
      communicationLogId = existing.id;
    }

    await enqueueJob(
      'deliverEmail',
      { template, sender, recipient, cc, bcc, data: dataVars, communicationLogId },
      { id: idempotencyKey },
    );
    fanned += 1;
  }

  log.info(`Email fanned out: template=${template} jobs=${fanned}`);
});
