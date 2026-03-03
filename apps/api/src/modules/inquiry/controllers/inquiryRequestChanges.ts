import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquiryRequestChangesRoute } from '#/modules/inquiry/routes/inquiryRequestChanges';
import { checkIsTarget } from '#/modules/inquiry/services/access';

export const inquiryRequestChangesController = makeController(inquiryRequestChangesRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const { id } = c.req.valid('param');
  const { explanation } = c.req.valid('json');

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  if (!inquiry) throw makeError({ status: 404, message: 'Inquiry not found', requestId: c.get('requestId') });
  if (![InquiryStatus.sent, InquiryStatus.changesRequested].includes(inquiry.status)) {
    throw makeError({ status: 400, message: 'Inquiry must be sent to request changes', requestId: c.get('requestId') });
  }

  const isTarget = await checkIsTarget(db, inquiry, user.id);
  if (!isTarget) throw makeError({ status: 403, message: 'Only the target can request changes', requestId: c.get('requestId') });

  const updated = await db.inquiry.update({
    where: { id },
    data: {
      status: InquiryStatus.changesRequested,
      resolution: {
        explanation,
        requestedBy: user.id,
        requestedAt: new Date().toISOString(),
      },
    },
  });

  return respond.ok(updated);
});
