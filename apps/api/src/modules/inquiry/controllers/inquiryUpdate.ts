import { HTTPException } from 'hono/http-exception';
import { getUser } from '#/lib/context/getUser';
import { makeController } from '#/lib/utils/makeController';
import { inquiryUpdateRoute } from '#/modules/inquiry/routes/inquiryUpdate';
import { checkIsSource } from '#/modules/inquiry/services/access';

export const inquiryUpdateController = makeController(inquiryUpdateRoute, async (c, respond) => {
  const user = getUser(c)!;
  const db = c.get('db');
  const { id } = c.req.valid('param');
  const data = c.req.valid('json');

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  if (!inquiry) {
    throw new HTTPException(404, { message: 'Inquiry not found' });
  }

  if (inquiry.status !== 'draft') {
    throw new HTTPException(400, { message: 'Only draft inquiries can be updated' });
  }

  const isSource = await checkIsSource(db, inquiry, user.id);
  if (!isSource) {
    throw new HTTPException(403, { message: 'Only the source can update' });
  }

  const updated = await db.inquiry.update({ where: { id }, data });

  return respond.ok(updated);
});
