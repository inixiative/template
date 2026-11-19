/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:email
 */
import { projectRows } from '@inixiative/json-rules';
import { db, polymorphicArmKeys } from '@template/db';
import { fetchLens } from '@template/db/hydrate';
import { EmailRenderError } from '@template/email/errors/EmailRenderError';
import {
  fetchTemplateLens,
  fetchTemplateThroughOwnerCascade,
  ownerScopeOfRow,
} from '@template/email/render';
import { declaredFields } from '@template/email/rules';
import { log } from '@template/shared/logger';
import {
  ConcurrencyType,
  minimumConcurrencyLimitFor,
  runAllWithConcurrencyLimit,
} from '@template/shared/utils';
import { pick } from 'lodash-es';
import { enqueueJob } from '#/jobs/enqueue';
import { makeJob } from '#/jobs/makeJob';
import { JobLane } from '#/jobs/types';
import { emailRegistry } from '#/lib/email';
import { bindLens } from '#/lib/email/bindLens';
import { bindWhere } from '#/lib/email/bindWhere';
import { emailJobLaneForRecipientCount } from '#/lib/email/emailJobLaneForRecipientCount';
import { emailLensFor } from '#/lib/email/emailLensFor';
import {
  emailTemplateRegistry,
  narrowSlotLensToRowsMatchingOrThrow,
} from '#/lib/email/emailTemplateRegistry';
import { deliverJobId, plannerJobId } from '#/lib/email/idempotency';
import type { Recipient } from '#/lib/email/recipient';
import type { Sender } from '#/lib/email/sender';
import { senderFromEntityFields } from '#/lib/email/senderFromEntityFields';
import { senderToOwnerScope } from '#/lib/emailTemplate';

export type PlanEmailDeliveriesPayload = {
  eventName: string;
  template: string;
  data: Record<string, unknown>;
};

const SENDER_COLUMNS = { senderUserId: null, senderOrganizationId: null, senderSpaceId: null };

const senderRow = (sender: Sender): Record<string, unknown> | null => {
  switch (sender.type) {
    case 'User':
      return { id: sender.userId };
    case 'Organization':
      return { id: sender.organizationId };
    case 'Space':
      return { id: sender.spaceId, organizationId: sender.organizationId };
    case 'OrganizationUser':
      return { organizationId: sender.organizationId, userId: sender.userId };
    case 'SpaceUser':
      return {
        organizationId: sender.organizationId,
        spaceId: sender.spaceId,
        userId: sender.userId,
      };
    default:
      return null;
  }
};

const senderColumns = (sender: Sender) => {
  const row = senderRow(sender);
  return {
    senderModel: sender.type,
    ...SENDER_COLUMNS,
    ...(row ? polymorphicArmKeys('CommunicationLog', 'senderModel', sender.type, row) : {}),
  };
};

export const planEmailDeliveries = makeJob<PlanEmailDeliveriesPayload>(async (_ctx, payload) => {
  const { eventName, template, data } = payload;

  const entry = emailTemplateRegistry[template];
  if (!entry)
    throw new Error(`No email registry entry for template "${template}" (event=${eventName})`);
  const fields = declaredFields(entry.data);
  for (const name of fields ?? []) {
    if (data[name] === undefined)
      throw new Error(
        `Email "${template}" declares data field "${name}" and the event did not supply it`,
      );
  }

  const entityLens = bindLens(entry.entity, data);
  const [entity] = await fetchLens(entityLens);
  if (!entity) return;

  if (!emailRegistry.names().length) {
    log.warn(`No email adapter registered — skipping (template=${template})`);
    return;
  }

  const entityRow = entity as Record<string, unknown>;
  const dataVars = fields ? pick(data, fields) : (projectRows(entityLens, [entityRow])[0] ?? {});

  const sender = senderFromEntityFields(entry.sender, entityRow);
  const row = await fetchTemplateThroughOwnerCascade(template, senderToOwnerScope(sender));
  if (!row) throw new EmailRenderError(template, 'template_missing');
  const targeting = bindWhere(entry.recipients.where, entityRow);
  const lens = narrowSlotLensToRowsMatchingOrThrow(
    emailLensFor(template, ownerScopeOfRow(row), await fetchTemplateLens(template, row), sender)
      .recipient,
    targeting,
  );
  const sendKey = plannerJobId(eventName, template, data);

  const users = await fetchLens(lens);
  const plan = users.map((user) => {
    const recipient = user as Recipient;
    return {
      user,
      recipient,
      idempotencyKey: deliverJobId(eventName, template, sender, recipient.email, dataVars),
    };
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
  for (const c of contactRows)
    if (c.userId && !contactByUser.has(c.userId)) contactByUser.set(c.userId, c.id);

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

  // A fan-out wider than the threshold is slow work: its deliveries share the fleet's slow-lane slots.
  // Slow enqueues mostly buffer to the outbox, so they run concurrently — sequential awaits would
  // each pay their own outbox write instead of committing together.
  const lane = emailJobLaneForRecipientCount(plan.length);
  const deliveries = plan.flatMap(({ user, recipient, idempotencyKey }) => {
    const communicationLogId = logByKey.get(idempotencyKey);
    if (!communicationLogId) return [];
    return [
      async () => {
        const userRow = user as Record<string, unknown>;
        await enqueueJob(
          'deliverEmail',
          {
            template,
            sender,
            recipientId: recipient.id,
            targeting,
            cc: entry.cc ? bindWhere(entry.cc.where, userRow) : undefined,
            bcc: entry.bcc ? bindWhere(entry.bcc.where, userRow) : undefined,
            data: dataVars,
            communicationLogId,
          },
          { id: idempotencyKey, lane },
        );
      },
    ];
  });
  await runAllWithConcurrencyLimit(
    deliveries,
    lane === JobLane.slow ? minimumConcurrencyLimitFor([ConcurrencyType.queue]) : 1,
  );
  const fanned = deliveries.length;

  log.info(`Email fanned out: template=${template} jobs=${fanned} lane=${lane}`);
});
