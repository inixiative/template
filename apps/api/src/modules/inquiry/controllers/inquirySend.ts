import { makeError } from '#/lib/errors';

import { makeController } from '#/lib/utils/makeController';
import { inquirySendRoute } from '#/modules/inquiry/routes/inquirySend';
import { checkIsSource } from '#/modules/inquiry/services/access';

export const inquirySendController = makeController(inquirySendRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const { id } = c.req.valid('param');

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  if (!inquiry) {
    throw makeError({ status: 404, message: 'Inquiry not found', requestId: c.get('requestId') });
  }

  if (inquiry.status !== 'draft') {
    throw makeError({ status: 400, message: 'Only draft inquiries can be sent', requestId: c.get('requestId') });
  }

  const hasTarget = inquiry.targetModel && (inquiry.targetUserId || inquiry.targetOrganizationId);
  if (!hasTarget) {
    throw makeError({ status: 400, message: 'Target must be set before sending', requestId: c.get('requestId') });
  }

  const isSource = await checkIsSource(db, inquiry, user.id);
  if (!isSource) {
    throw makeError({ status: 403, message: 'Only the source can send', requestId: c.get('requestId') });
  }

  const updated = await db.inquiry.update({
    where: { id },
    data: { status: 'sent', sentAt: new Date() },
  });

  return respond.ok(updated);
});
