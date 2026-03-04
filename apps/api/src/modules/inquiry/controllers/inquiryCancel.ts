import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryCancelRoute } from '#/modules/inquiry/routes/inquiryCancel';

export const inquiryCancelController = makeController(inquiryCancelRoute, async (c, respond) => {
  const db = c.get('db');
  const inquiry = getResource<'inquiry'>(c);

  if ([InquiryStatus.approved, InquiryStatus.denied, InquiryStatus.canceled].includes(inquiry.status)) {
    throw makeError({ status: 400, message: 'Cannot cancel a resolved or already canceled inquiry', requestId: c.get('requestId') });
  }

  await db.inquiry.update({ where: { id: inquiry.id }, data: { status: InquiryStatus.canceled } });

  return respond.noContent();
});
