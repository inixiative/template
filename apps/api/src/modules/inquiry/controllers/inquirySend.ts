import { InquiryStatus } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { includeInquirySent } from '#/modules/inquiry/queries/inquiryIncludes';
import { inquirySendRoute } from '#/modules/inquiry/routes/inquirySend';
import { computeExpiresAt } from '#/modules/inquiry/services/computeExpiresAt';
import { resolveInquiry } from '#/modules/inquiry/services/resolution';
import { validateInquiryIsDraft } from '#/modules/inquiry/validations/validateInquiryStatus';

export const inquirySendController = makeController(inquirySendRoute, async (c, respond) => {
  const db = c.get('db');
  const inquiry = getResource<'inquiry'>(c);

  validateInquiryIsDraft(inquiry);

  if (!inquiry.targetModel) throw makeError({ status: 400, message: 'Target must be set before sending' });

  const sent = await db.inquiry.update({
    where: { id: inquiry.id },
    data: { status: InquiryStatus.sent, sentAt: new Date(), expiresAt: computeExpiresAt(inquiry.type) },
    include: includeInquirySent,
  });

  const handler = inquiryHandlers[inquiry.type];
  if (await handler.autoApprove(db, inquiry)) {
    const approved = await resolveInquiry(c, inquiry, InquiryStatus.approved, {});
    return respond.ok({ ...sent, ...approved });
  }

  return respond.ok(sent);
});
