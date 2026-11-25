/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma, primitive:appEvents
 */
import type { Condition } from '@inixiative/json-rules';
import { db, Prisma } from '@template/db';
import { CommunicationReasonCode } from '@template/db/generated/client/enums';
import { EmailProviderError } from '@template/email/errors/EmailProviderError';
import { EmailRenderError } from '@template/email/errors/EmailRenderError';
import { isEmailContentError } from '@template/email/errors/isEmailContentError';
import { deriveTextFromHtml, sanitizeSubject, type Variables } from '@template/email/render';
import { LogScope, log } from '@template/shared/logger';
import { withRetry } from '@template/shared/utils';
import mjml2html from 'mjml';
import { emitAppEvent } from '#/appEvents/emit';
import { defaultEmailClient, emailVerifier, resolveFromAddress } from '#/lib/email';
import { communicationReasonCodeFor } from '#/lib/email/communicationReasonCode';
import {
  fetchRecipientEmailAddressesMatching,
  recipientVariables,
} from '#/lib/email/renderForRecipient';
import type { Sender } from '#/lib/email/sender';
import { unsubscribeUrl } from '#/lib/email/unsubscribe';
import { type RenderedEmailTemplate, renderEmailTemplateWithFallback } from '#/lib/emailTemplate';
import { canDeliver } from '#/lib/messaging/canDeliver';
import { recordCommunicationOutcome } from '#/lib/messaging/recordCommunicationOutcome';
import { isShutdownInProgress, sleepUnlessShuttingDown } from '#/lib/shutdown';

const DELIVERABILITY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SEND_ATTEMPTS = 6;
const SEND_RETRY_BASE_DELAY_MS = 2_000;

export type DeliverEmailPayload = {
  template: string;
  sender: Sender;
  recipientId: string;
  targeting?: Condition;
  cc?: Condition;
  bcc?: Condition;
  data: Record<string, unknown>;
  communicationLogId: string;
};

export type DeliverEmailMessageOptions = {
  sleep?: (ms: number) => Promise<void>;
};

const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Once shutdown starts, the next failure is recorded instead of retried: an in-claim backoff can run
// past the shutdown timeout, and a force-exit mid-backoff would strand the row in `sending`.
const isRetryableSendError = (error: unknown): boolean =>
  error instanceof EmailProviderError && error.isRetryable && !isShutdownInProgress();

// The claim reads the row and nothing else: only a `queued` row is open. `sending`, `sent`, and every
// recorded outcome are closed, so a retry, a duplicate job, or a re-dispatch never resends. A crash
// between claim and the recorded outcome leaves `sending` for a user to resolve, never for the claim to reopen.
// Failures before the claim that nothing deterministic caused (the verifier, the database) throw
// with the row still `queued`, so the job retry picks it up — nothing has been sent yet.
export const deliverEmailMessage = async (
  payload: DeliverEmailPayload,
  { sleep = sleepUnlessShuttingDown }: DeliverEmailMessageOptions = {},
): Promise<void> => {
  const { template, sender, recipientId, targeting, data, communicationLogId } = payload;
  const open = { id: communicationLogId, status: 'queued' as const };

  const entry = await db.communicationLog.findUnique({
    where: { id: communicationLogId },
    select: {
      status: true,
      reasonCode: true,
      address: true,
      recipientContactId: true,
      recipientContact: {
        select: { acceptedKinds: true, deliverability: true, deliverabilityCheckedAt: true },
      },
    },
  });
  if (!entry) return;
  if (entry.status !== 'queued') {
    log.info(
      `Communication ${communicationLogId} already closed (${entry.status}${entry.reasonCode ? `, ${entry.reasonCode}` : ''}); skipping`,
      LogScope.email,
    );
    return;
  }

  const recordRenderFailure = (error: unknown) =>
    recordCommunicationOutcome(open, {
      status: 'failed',
      reasonCode:
        error instanceof EmailRenderError &&
        (error.type === 'recipient_missing' || error.type === 'data_missing')
          ? CommunicationReasonCode.not_found
          : CommunicationReasonCode.render_failed,
      error: errorMessageOf(error),
    });

  let renderedTemplate: RenderedEmailTemplate;
  let address = entry.address;
  let cc: string[] | undefined;
  let bcc: string[] | undefined;
  try {
    renderedTemplate = await renderEmailTemplateWithFallback(
      template,
      sender,
      async (lens) => {
        const variables = await recipientVariables(lens, {
          recipientId,
          sender,
          targeting,
          data,
          label: template,
        });
        address = String(variables.recipient?.email ?? entry.address);
        cc = await fetchRecipientEmailAddressesMatching(lens, payload.cc);
        bcc = await fetchRecipientEmailAddressesMatching(lens, payload.bcc);
        return variables;
      },
      (kind) => {
        if (kind === 'system') return {};
        if (!entry.recipientContactId)
          throw new EmailRenderError(template, 'unsubscribe_unavailable');
        return {
          unsubscribeUrl: unsubscribeUrl({
            userId: recipientId,
            contactId: entry.recipientContactId,
            kind,
          }),
        };
      },
    );
  } catch (error) {
    if (!isEmailContentError(error)) throw error;
    await recordRenderFailure(error);
    return;
  }
  const resolved = {
    kind: renderedTemplate.kind,
    emailTemplateId: renderedTemplate.emailTemplateId,
    emailTemplateAuditLogId: renderedTemplate.emailTemplateAuditLogId,
  };

  const isContactRemoved = entry.recipientContactId != null && entry.recipientContact == null;
  const deliverable = entry.recipientContact
    ? canDeliver(renderedTemplate.kind, entry.recipientContact)
    : renderedTemplate.kind === 'system';
  if (isContactRemoved || !deliverable) {
    await recordCommunicationOutcome(open, { status: 'suppressed', address, ...resolved });
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
    const verdict = await emailVerifier.verify(address);
    deliverability = verdict.status;
    undeliverableReason = verdict.reason ?? null;
    if (entry.recipientContactId) {
      const contact = await db.contact.update({
        where: { id: entry.recipientContactId },
        data: { deliverability: verdict.status, deliverabilityCheckedAt: new Date() },
      });
      await emitAppEvent('contact.updated', { contact });
    }
  }
  if (deliverability === 'undeliverable') {
    await recordCommunicationOutcome(open, {
      status: 'undeliverable',
      address,
      error: undeliverableReason ?? 'undeliverable',
      ...resolved,
    });
    return;
  }

  let html: string;
  try {
    html = (await mjml2html(renderedTemplate.mjml, { validationLevel: 'skip' })).html;
  } catch (error) {
    await recordRenderFailure(error);
    return;
  }
  const from = await resolveFromAddress(renderedTemplate.slug, sender);
  const headers =
    renderedTemplate.kind !== 'system' && entry.recipientContactId
      ? {
          'List-Unsubscribe': `<${unsubscribeUrl({ userId: recipientId, contactId: entry.recipientContactId, kind: renderedTemplate.kind })}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      : undefined;

  const claimed = await db.txn(async () => {
    const rows = await db.communicationLog.updateManyAndReturn({
      where: open,
      data: {
        status: 'sending',
        address,
        ...resolved,
        evaluatedMjml: renderedTemplate.mjml,
        variables: renderedTemplate.variables as Prisma.InputJsonValue,
        renderIssues: renderedTemplate.issues.length
          ? (renderedTemplate.issues as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
    if (rows.length === 0) return rows;

    await db.communicationComponentVersion.deleteMany({ where: { communicationLogId } });
    const resolutions = Object.entries(renderedTemplate.componentResolutions);
    if (resolutions.length > 0) {
      const snapshots = await db.auditLog.findMany({
        where: {
          subjectEmailComponentId: { in: resolutions.map(([, componentId]) => componentId) },
        },
        orderBy: { id: 'desc' },
        distinct: ['subjectEmailComponentId'],
        select: { id: true, subjectEmailComponentId: true },
      });
      const latestByComponent = new Map(
        snapshots.map((snapshot) => [snapshot.subjectEmailComponentId, snapshot.id]),
      );
      await db.communicationComponentVersion.createManyAndReturn({
        data: resolutions.map(([slug, emailComponentId]) => ({
          communicationLogId,
          slug,
          emailComponentId,
          emailComponentAuditLogId: latestByComponent.get(emailComponentId) ?? null,
        })),
      });
    }
    return rows;
  });
  if (claimed.length === 0) return;

  let providerMessageId: string;
  try {
    const result = await withRetry(
      () =>
        defaultEmailClient().send({
          to: address,
          cc,
          bcc,
          from,
          subject: sanitizeSubject(renderedTemplate.subject),
          html,
          text: deriveTextFromHtml(html),
          headers,
          idempotencyKey: communicationLogId,
        }),
      {
        attempts: SEND_ATTEMPTS,
        baseDelayMs: SEND_RETRY_BASE_DELAY_MS,
        isRetryable: isRetryableSendError,
        onRetry: (error, attempt, waitMs) =>
          log.warn(
            `Email send for ${communicationLogId} retrying (attempt ${attempt}, in ${waitMs}ms): ${errorMessageOf(error)}`,
            LogScope.email,
          ),
        sleep,
      },
    );
    if (!result.success) throw new Error(`Email provider rejected send (id=${result.id})`);
    providerMessageId = result.id;
  } catch (error) {
    // Recorded, not thrown: the send is at-most-once. If this write itself fails, the throw below
    // retries the job, which meets the `sending` row and stops.
    await recordCommunicationOutcome(
      { id: communicationLogId, status: 'sending' },
      {
        status: 'failed',
        reasonCode: communicationReasonCodeFor(error),
        error: errorMessageOf(error),
      },
    );
    log.error(`Email send for ${communicationLogId} failed`, error, LogScope.email);
    return;
  }
  await recordCommunicationOutcome(
    { id: communicationLogId, status: 'sending' },
    { status: 'sent', providerMessageId, sentAt: new Date() },
  );
};
