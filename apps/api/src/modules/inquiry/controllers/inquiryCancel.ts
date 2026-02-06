import { HTTPException } from 'hono/http-exception';

import { makeController } from '#/lib/utils/makeController';
import { inquiryCancelRoute } from '#/modules/inquiry/routes/inquiryCancel';
import { checkIsSource } from '#/modules/inquiry/services/access';

export const inquiryCancelController = makeController(inquiryCancelRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const { id } = c.req.valid('param');

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  if (!inquiry) {
    throw new HTTPException(404, { message: 'Inquiry not found' });
  }

  if (inquiry.status === 'resolved' || inquiry.status === 'canceled') {
    throw new HTTPException(400, { message: 'Cannot cancel resolved or already canceled inquiry' });
  }

  const isSource = await checkIsSource(db, inquiry, user.id);
  if (!isSource) {
    throw new HTTPException(403, { message: 'Only the source can cancel' });
  }

  await db.inquiry.update({
    where: { id },
    data: { status: 'canceled' },
  });

  return respond.noContent();
});
