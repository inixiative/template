import { makeError } from '#/lib/errors';

import { makeController } from '#/lib/utils/makeController';
import { inquiryReadRoute } from '#/modules/inquiry/routes/inquiryRead';
import { checkInquiryAccess } from '#/modules/inquiry/services/access';

export const inquiryReadController = makeController(inquiryReadRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const { id } = c.req.valid('param');

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  if (!inquiry) {
    throw makeError({ status: 404, message: 'Inquiry not found', requestId: c.get('requestId') });
  }

  const hasAccess = await checkInquiryAccess(db, inquiry, user.id);
  if (!hasAccess) {
    throw makeError({ status: 403, message: 'Access denied', requestId: c.get('requestId') });
  }

  return respond.ok(inquiry);
});
