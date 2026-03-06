import { InquiryStatus } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryCancelRoute } from '#/modules/inquiry/routes/inquiryCancel';
import { validateInquiryIsCancelable } from '#/modules/inquiry/validations/validateInquiryStatus';

export const inquiryCancelController = makeController(inquiryCancelRoute, async (c, respond) => {
  const db = c.get('db');
  const inquiry = getResource<'inquiry'>(c);

  validateInquiryIsCancelable(inquiry);

  await db.inquiry.update({ where: { id: inquiry.id }, data: { status: InquiryStatus.canceled } });

  return respond.noContent();
});
