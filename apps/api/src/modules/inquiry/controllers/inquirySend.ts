import type { HydratedRecord } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquirySendRoute } from '#/modules/inquiry/routes/inquirySend';
import { assertInquiryPermission } from '#/modules/inquiry/services/utils/assertInquiryPermission';

export const inquirySendController = makeController(inquirySendRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const { id } = c.req.valid('param');

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  if (!inquiry) throw makeError({ status: 404, message: 'Inquiry not found', requestId: c.get('requestId') });
  if (inquiry.status !== InquiryStatus.draft) {
    throw makeError({ status: 400, message: 'Only draft inquiries can be sent', requestId: c.get('requestId') });
  }

  const hasTarget = inquiry.targetModel && (inquiry.targetUserId || inquiry.targetOrganizationId);
  if (!hasTarget) throw makeError({ status: 400, message: 'Target must be set before sending', requestId: c.get('requestId') });

  await assertInquiryPermission(db, permix, inquiry as unknown as HydratedRecord, 'send', c.get('requestId'));

  const updated = await db.inquiry.update({
    where: { id },
    data: { status: InquiryStatus.sent, sentAt: new Date() },
  });

  return respond.ok(updated);
});
