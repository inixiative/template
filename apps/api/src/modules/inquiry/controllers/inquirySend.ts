import { HTTPException } from 'hono/http-exception';
import { getUser } from '#/lib/context/getUser';
import { makeController } from '#/lib/utils/makeController';
import { inquirySendRoute } from '#/modules/inquiry/routes/inquirySend';
import { checkIsSource } from '#/modules/inquiry/services/access';

export const inquirySendController = makeController(inquirySendRoute, async (c, respond) => {
  const user = getUser(c)!;
  const db = c.get('db');
  const { id } = c.req.valid('param');

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  if (!inquiry) {
    throw new HTTPException(404, { message: 'Inquiry not found' });
  }

  if (inquiry.status !== 'draft') {
    throw new HTTPException(400, { message: 'Only draft inquiries can be sent' });
  }

  const hasTarget = inquiry.targetModel && (inquiry.targetUserId || inquiry.targetOrganizationId);
  if (!hasTarget) {
    throw new HTTPException(400, { message: 'Target must be set before sending' });
  }

  const isSource = await checkIsSource(db, inquiry, user.id);
  if (!isSource) {
    throw new HTTPException(403, { message: 'Only the source can send' });
  }

  const updated = await db.inquiry.update({
    where: { id },
    data: { status: 'sent', sentAt: new Date() },
  });

  return respond.ok(updated);
});
