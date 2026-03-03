import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquiryCancelRoute } from '#/modules/inquiry/routes/inquiryCancel';
import { checkIsSource } from '#/modules/inquiry/services/access';

export const inquiryCancelController = makeController(inquiryCancelRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const { id } = c.req.valid('param');

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  if (!inquiry) throw makeError({ status: 404, message: 'Inquiry not found', requestId: c.get('requestId') });
  if ([InquiryStatus.approved, InquiryStatus.denied, InquiryStatus.canceled].includes(inquiry.status)) {
    throw makeError({ status: 400, message: 'Cannot cancel a resolved or already canceled inquiry', requestId: c.get('requestId') });
  }

  const isSource = await checkIsSource(db, inquiry, user.id);
  if (!isSource) throw makeError({ status: 403, message: 'Only the source can cancel', requestId: c.get('requestId') });

  await db.inquiry.update({ where: { id }, data: { status: InquiryStatus.canceled } });

  return respond.noContent();
});
