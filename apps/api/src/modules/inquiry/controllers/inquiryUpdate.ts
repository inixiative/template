import { makeError } from '#/lib/errors';

import { makeController } from '#/lib/utils/makeController';
import { inquiryUpdateRoute } from '#/modules/inquiry/routes/inquiryUpdate';
import { checkIsSource } from '#/modules/inquiry/services/access';

export const inquiryUpdateController = makeController(inquiryUpdateRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const { id } = c.req.valid('param');
  const data = c.req.valid('json');

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  if (!inquiry) {
    throw makeError({ status: 404, message: 'Inquiry not found', requestId: c.get('requestId') });
  }

  if (inquiry.status !== 'draft') {
    throw makeError({ status: 400, message: 'Only draft inquiries can be updated', requestId: c.get('requestId') });
  }

  const isSource = await checkIsSource(db, inquiry, user.id);
  if (!isSource) {
    throw makeError({ status: 403, message: 'Only the source can update', requestId: c.get('requestId') });
  }

  const updated = await db.inquiry.update({ where: { id }, data });

  return respond.ok(updated);
});
