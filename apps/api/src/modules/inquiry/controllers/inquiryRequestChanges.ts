import type { HydratedRecord } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquiryRequestChangesRoute } from '#/modules/inquiry/routes/inquiryRequestChanges';
import { assertInquiryPermission } from '#/modules/inquiry/services/utils/assertInquiryPermission';

export const inquiryRequestChangesController = makeController(inquiryRequestChangesRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const permix = c.get('permix');
  const { id } = c.req.valid('param');
  const { explanation } = c.req.valid('json');

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  if (!inquiry) throw makeError({ status: 404, message: 'Inquiry not found', requestId: c.get('requestId') });
  if (![InquiryStatus.sent, InquiryStatus.changesRequested].includes(inquiry.status)) {
    throw makeError({ status: 400, message: 'Inquiry must be sent to request changes', requestId: c.get('requestId') });
  }

  await assertInquiryPermission(db, permix, inquiry as unknown as HydratedRecord, 'requestChanges', c.get('requestId'));

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
