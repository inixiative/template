import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquirySendRoute } from '#/modules/inquiry/routes/inquirySend';

export const inquirySendController = makeController(inquirySendRoute, async (c, respond) => {
  const db = c.get('db');
  const inquiry = getResource<'inquiry'>(c);

  if (inquiry.status !== InquiryStatus.draft) {
    throw makeError({ status: 400, message: 'Only draft inquiries can be sent', requestId: c.get('requestId') });
  }

  const hasTarget = inquiry.targetModel && (inquiry.targetUserId || inquiry.targetOrganizationId);
  if (!hasTarget) throw makeError({ status: 400, message: 'Target must be set before sending', requestId: c.get('requestId') });

  const updated = await db.inquiry.update({
    where: { id: inquiry.id },
    data: { status: InquiryStatus.sent, sentAt: new Date() },
  });

  return respond.ok(updated);
});
