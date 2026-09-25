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
import { resolveInquiry } from '#/modules/inquiry/services/resolution';
import { validateInquiryIsDraft } from '#/modules/inquiry/validations/validateInquiryStatus';
import type { AppEnv } from '#/types/appEnv';

export const sendInquiry = async (c: Context<AppEnv>, inquiry: Inquiry) => {
  const db = c.get('db');

  validateInquiryIsDraft(inquiry);

  if (!inquiry.targetModel) throw makeError({ status: 400, message: 'Target must be set before sending' });

  const sent = await db.inquiry.update({
    where: { id: inquiry.id },
    data: { status: InquiryStatus.sent, sentAt: new Date(), expiresAt: computeExpiresAt(inquiry.type) },
    include: includeInquirySent,
  });

  const handler = inquiryHandlers[inquiry.type];
  const autoApproved = await handler.autoApprove(db, sent);

  if (autoApproved) {
    await resolveInquiry(c, sent, InquiryStatus.approved, {});

    const approved = await db.inquiry.findUniqueOrThrow({
      where: { id: sent.id },
      include: includeInquirySent,
    });

    await emitAppEvent('inquiry.sent', approved);

    return approved;
  }

  await emitAppEvent('inquiry.sent', sent);

  return sent;
};
