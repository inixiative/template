/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:email
 */
import { db } from '@template/db';
import type { Variables } from '@template/email/render';
import mjml2html from 'mjml';
import { makeJob } from '#/jobs/makeJob';
import { defaultEmailClient, emailVerifier, resolveFromAddress } from '#/lib/email';
import { resolveSender } from '#/lib/email/resolveSender';
import type { Sender } from '#/lib/email/sender';
import { unsubscribeUrl } from '#/lib/email/unsubscribe';
import { type SettledTemplate, settleTemplate } from '#/lib/emailTemplate';
import { canDeliver } from '#/lib/messaging/canDeliver';

const DELIVERABILITY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type DeliverEmailPayload = {
  template: string;
  sender: Sender;
  recipient: { id: string; name: string; email: string };
  cc?: string[];
  bcc?: string[];
  data: Record<string, unknown>;
  communicationLogId: string;
};

export const deliverEmail = makeJob<DeliverEmailPayload>(async (_ctx, payload) => {
  const { template, sender, recipient, cc, bcc, data, communicationLogId } = payload;

  const entry = await db.communicationLog.findUnique({
    where: { id: communicationLogId },
    select: {
      status: true,
      recipientContactId: true,
      recipientContact: {
        select: { acceptedKinds: true, deliverability: true, deliverabilityCheckedAt: true },
      },
    },
  });
  if (!entry || entry.status === 'sent') return;

  const variables: Variables = { sender: await resolveSender(sender), recipient, data };

  let settled: SettledTemplate;
  try {
    settled = await settleTemplate(template, sender, variables, (kind) =>
      kind !== 'system' && entry.recipientContactId
        ? { unsubscribeUrl: unsubscribeUrl({ userId: recipient.id, contactId: entry.recipientContactId, kind }) }
        : {},
    );
  } catch (error) {
    await db.communicationLog.updateManyAndReturn({
      where: { id: communicationLogId, status: { in: ['queued', 'failed'] } },
      data: { status: 'failed', error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
  const emailTemplateAuditLog = settled.emailTemplateId
    ? await db.auditLog.findFirst({
        where: { subjectEmailTemplateId: settled.emailTemplateId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
    : null;
  const resolved = {
    kind: settled.kind,
    emailTemplateId: settled.emailTemplateId,
    emailTemplateAuditLogId: emailTemplateAuditLog?.id ?? null,
  };

  const deliverable = entry.recipientContact
    ? canDeliver(settled.kind, entry.recipientContact)
    : settled.kind === 'system';
  if (!deliverable) {
    await db.communicationLog.updateManyAndReturn({
      where: { id: communicationLogId, status: { in: ['queued', 'failed'] } },
      data: { status: 'suppressed', ...resolved },
    });
    return;
  }

  const cached = entry.recipientContact;
  const cacheFresh =
    cached?.deliverability != null &&
    cached.deliverabilityCheckedAt != null &&
    Date.now() - cached.deliverabilityCheckedAt.getTime() < DELIVERABILITY_TTL_MS;

  let deliverability: string | null = cacheFresh ? cached.deliverability : null;
  let undeliverableReason: string | null = null;
  if (deliverability === null) {
    const verdict = await emailVerifier.verify(recipient.email);
    deliverability = verdict.status;
    undeliverableReason = verdict.reason ?? null;
    if (entry.recipientContactId) {
      await db.contact.update({
        where: { id: entry.recipientContactId },
        data: { deliverability: verdict.status, deliverabilityCheckedAt: new Date() },
      });
    }
  }
  if (deliverability === 'undeliverable') {
    await db.communicationLog.updateManyAndReturn({
      where: { id: communicationLogId, status: { in: ['queued', 'failed'] } },
      data: { status: 'undeliverable', error: undeliverableReason ?? 'undeliverable', ...resolved },
    });
    return;
  }

  const claimed = await db.communicationLog.updateManyAndReturn({
    where: { id: communicationLogId, status: { in: ['queued', 'failed'] } },
    data: { status: 'sending', ...resolved },
  });
  if (claimed.length === 0) return;

  try {
    const from = await resolveFromAddress(template, sender);
    const { html } = await mjml2html(settled.mjml, { validationLevel: 'skip' });
    const headers =
      settled.kind !== 'system' && entry.recipientContactId
        ? {
            'List-Unsubscribe': `<${unsubscribeUrl({ userId: recipient.id, contactId: entry.recipientContactId, kind: settled.kind })}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined;
    const result = await defaultEmailClient().send({
      to: recipient.email,
      cc,
      bcc,
      from,
      subject: settled.subject,
      html,
      headers,
    });
    if (!result.success) throw new Error(`Email provider rejected send (id=${result.id})`);
    await db.communicationLog.updateManyAndReturn({
      where: { id: communicationLogId, status: 'sending' },
      data: { status: 'sent', providerMessageId: result.id, sentAt: new Date() },
    });
  } catch (error) {
    await db.communicationLog.updateManyAndReturn({
      where: { id: communicationLogId, status: 'sending' },
      data: { status: 'failed', error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
});
