import { HTTPException } from 'hono/http-exception';

import { makeController } from '#/lib/utils/makeController';
import { inquiryResolveRoute } from '#/modules/inquiry/routes/inquiryResolve';
import { checkIsTarget } from '#/modules/inquiry/services/access';
import { resolveInquiry } from '#/modules/inquiry/services/resolution';

export const inquiryResolveController = makeController(inquiryResolveRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const { id } = c.req.valid('param');
  const { outcome, explanation } = c.req.valid('json');

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  if (!inquiry) {
    throw new HTTPException(404, { message: 'Inquiry not found' });
  }

  if (!['sent', 'acknowledged'].includes(inquiry.status)) {
    throw new HTTPException(400, { message: 'Inquiry must be sent or acknowledged to resolve' });
  }

  const isTarget = await checkIsTarget(db, inquiry, user.id);
  if (!isTarget) {
    throw new HTTPException(403, { message: 'Only the target can resolve' });
  }

  const resolved = await resolveInquiry(db, inquiry, outcome, explanation, user.id);

  return respond.ok(resolved);
});
