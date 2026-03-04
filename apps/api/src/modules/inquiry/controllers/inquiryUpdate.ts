import { InquiryStatus } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { inquiryUpdateRoute } from '#/modules/inquiry/routes/inquiryUpdate';
import { assertInquiryIsEditable } from '#/modules/inquiry/services/utils/validateInquiryStatus';

export const inquiryUpdateController = makeController(inquiryUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const inquiry = getResource<'inquiry'>(c);
  const data = c.req.valid('json');

  assertInquiryIsEditable(inquiry, c.get('requestId'));

  const handler = inquiryHandlers[inquiry.type];
  if (handler.validate) await handler.validate(db, inquiry);

  const updated = await db.inquiry.update({
    where: { id: inquiry.id },
    data: {
      ...data,
      ...(data.status === InquiryStatus.sent && !inquiry.sentAt ? { sentAt: new Date() } : {}),
    },
  });

  return respond.ok(updated);
});
