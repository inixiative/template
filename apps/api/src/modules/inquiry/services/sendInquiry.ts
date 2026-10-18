/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses infrastructure:prisma, primitive:appEvents
 */
import { InquiryStatus } from '@template/db/generated/client/enums';
import type { Context } from 'hono';
import { emitAppEvent } from '#/appEvents/emit';
import { makeError } from '#/lib/errors';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import type { Inquiry } from '#/modules/inquiry/handlers/types';
import { includeInquirySent } from '#/modules/inquiry/queries/inquiryIncludes';
import { computeExpiresAt } from '#/modules/inquiry/services/computeExpiresAt';
import { lockInquiryAtVersion } from '#/modules/inquiry/services/lockInquiryAtVersion';
import { resolveInquiry } from '#/modules/inquiry/services/resolution';
import { validateInquiryIsSendable } from '#/modules/inquiry/validations/validateInquiryStatus';
import type { AppEnv } from '#/types/appEnv';

export const sendInquiry = async (
  c: Context<AppEnv>,
  inquiry: Inquiry,
  expectedUpdatedAt?: Date,
) => {
  const db = c.get('db');

  return db.txn(async () => {
    const fresh = await lockInquiryAtVersion(inquiry.id, expectedUpdatedAt);

    if (fresh.status === InquiryStatus.sent)
      return db.inquiry.findUniqueOrThrow({ where: { id: fresh.id }, include: includeInquirySent });

    validateInquiryIsSendable(fresh);

    if (!fresh.targetModel)
      throw makeError({ status: 400, message: 'Target must be set before sending' });

    const sent = await db.inquiry.update({
      where: { id: fresh.id },
      data: {
        status: InquiryStatus.sent,
        sentAt: fresh.sentAt ?? new Date(),
        expiresAt: computeExpiresAt(fresh.type),
      },
      include: includeInquirySent,
    });

    const handler = inquiryHandlers[fresh.type];
    const autoApproved =
      (await handler.autoApprove(sent)) &&
      (!handler.canApprove ||
        (await handler.canApprove(c, sent, handler.contentSchema.parse(sent.content))));

    if (autoApproved) {
      await resolveInquiry(c, sent, InquiryStatus.approved, {}, sent.updatedAt);

      const approved = await db.inquiry.findUniqueOrThrow({
        where: { id: sent.id },
        include: includeInquirySent,
      });

      await emitAppEvent('inquiry.sent', approved);

      return approved;
    }

    await emitAppEvent('inquiry.sent', sent);

    return sent;
  });
};
