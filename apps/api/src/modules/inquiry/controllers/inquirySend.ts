import { InquiryStatus } from '@template/db/generated/client/enums';
import { emitAppEvent } from '#/appEvents/emit';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
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
    include: includeInquiryResponse,
  });

  const handler = inquiryHandlers[inquiry.type];
  const autoApproved = await handler.autoApprove(db, sent);

  if (autoApproved) {
    await resolveInquiry(c, sent, InquiryStatus.approved, {});

    const approved = await db.inquiry.findUniqueOrThrow({
      where: { id: sent.id },
      include: includeInquiryResponse,
    });

    await emitAppEvent('inquiry.sent', approved, {
      resourceType: 'Inquiry',
      resourceId: approved.id,
    });

    return respond.ok(approved);
  }

  await emitAppEvent('inquiry.sent', sent, {
    resourceType: 'Inquiry',
    resourceId: sent.id,
  });

  return respond.ok(sent);
});
