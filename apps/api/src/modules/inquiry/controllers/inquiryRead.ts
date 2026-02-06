import { HTTPException } from 'hono/http-exception';

import { makeController } from '#/lib/utils/makeController';
import { inquiryReadRoute } from '#/modules/inquiry/routes/inquiryRead';
import { checkInquiryAccess } from '#/modules/inquiry/services/access';

export const inquiryReadController = makeController(inquiryReadRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const { id } = c.req.valid('param');

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  if (!inquiry) {
    throw new HTTPException(404, { message: 'Inquiry not found' });
  }

  const hasAccess = await checkInquiryAccess(db, inquiry, user.id);
  if (!hasAccess) {
    throw new HTTPException(403, { message: 'Access denied' });
  }

  return respond.ok(inquiry);
});
