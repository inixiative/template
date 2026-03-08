import { InquiryStatus } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquirySendRoute } from '#/modules/inquiry/routes/inquirySend';
import { validateInquiryIsDraft } from '#/modules/inquiry/validations/validateInquiryStatus';

export const inquirySendController = makeController(inquirySendRoute, async (c, respond) => {
  const db = c.get('db');
  const inquiry = getResource<'inquiry'>(c);

  validateInquiryIsDraft(inquiry);

  if (!inquiry.targetModel) throw makeError({ status: 400, message: 'Target must be set before sending' });

  const updated = await db.inquiry.update({
    where: { id: inquiry.id },
    data: { status: InquiryStatus.sent, sentAt: new Date() },
  });

  return respond.ok(updated);
});
