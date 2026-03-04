import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryRequestChangesRoute } from '#/modules/inquiry/routes/inquiryRequestChanges';

export const inquiryRequestChangesController = makeController(inquiryRequestChangesRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const inquiry = getResource<'inquiry'>(c);
  const { explanation } = c.req.valid('json');

  if (![InquiryStatus.sent, InquiryStatus.changesRequested].includes(inquiry.status)) {
    throw makeError({ status: 400, message: 'Inquiry must be sent to request changes', requestId: c.get('requestId') });
  }

  const updated = await db.inquiry.update({
    where: { id: inquiry.id },
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
