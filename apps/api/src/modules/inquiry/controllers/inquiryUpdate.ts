import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryUpdateRoute } from '#/modules/inquiry/routes/inquiryUpdate';

export const inquiryUpdateController = makeController(inquiryUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const inquiry = getResource<'inquiry'>(c);
  const data = c.req.valid('json');

  if (inquiry.status !== InquiryStatus.draft) throw makeError({ status: 400, message: 'Only draft inquiries can be updated', requestId: c.get('requestId') });

  const updated = await db.inquiry.update({ where: { id: inquiry.id }, data });

  return respond.ok(updated);
});
