/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:email
 */
import type { LensNarrowing } from '@inixiative/json-rules';
import { db } from '@template/db';
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

  const users = await fetchLens(db, recipientLens);
  const plan = users.map((user) => {
    const recipient = prune(user, recipientLens) as Recipient;
    return { user, recipient, idempotencyKey: deliverJobId(eventName, template, sender, recipient.email, dataVars) };
  });
  if (!plan.length) {
    log.info(`Email fanned out: template=${template} jobs=0`);
    return;
  }

  const contactRows = await db.contact.findMany({
    where: { userId: { in: plan.map((p) => p.recipient.id) }, type: 'email', deletedAt: null },
    orderBy: { position: 'asc' },
    select: { id: true, userId: true },
  });
  const contactByUser = new Map<string, string>();
  for (const c of contactRows) if (c.userId && !contactByUser.has(c.userId)) contactByUser.set(c.userId, c.id);

  const created = await db.communicationLog.createManyAndReturn({
    data: plan.map((p) => ({
      channel: 'email' as const,
      sendKey,
      idempotencyKey: p.idempotencyKey,
      address: p.recipient.email,
      recipientUserId: p.recipient.id,
      recipientContactId: contactByUser.get(p.recipient.id) ?? null,
      ...senderColumns(sender),
    })),
    skipDuplicates: true,
  });
  const logByKey = new Map(created.map((l) => [l.idempotencyKey, l.id]));
  const missing = plan.filter((p) => !logByKey.has(p.idempotencyKey)).map((p) => p.idempotencyKey);
  if (missing.length) {
    const existing = await db.communicationLog.findMany({
      where: { idempotencyKey: { in: missing } },
      select: { id: true, idempotencyKey: true },
    });
    for (const l of existing) logByKey.set(l.idempotencyKey, l.id);
  }

  let fanned = 0;
  for (const { user, recipient, idempotencyKey } of plan) {
    const communicationLogId = logByKey.get(idempotencyKey);
    if (!communicationLogId) continue;
    const cc = entry.cc ? await emailsOf(entry.cc(user, sender)) : undefined;
    const bcc = entry.bcc ? await emailsOf(entry.bcc(user, sender)) : undefined;
    await enqueueJob(
      'deliverEmail',
      { template, sender, recipient, cc, bcc, data: dataVars, communicationLogId },
      { id: idempotencyKey },
    );
    fanned += 1;
  }

  log.info(`Email fanned out: template=${template} jobs=${fanned}`);
});
