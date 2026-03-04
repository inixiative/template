import type { HydratedRecord } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { inquiryResolveRoute } from '#/modules/inquiry/routes/inquiryResolve';
import { assertInquiryPermission } from '#/modules/inquiry/services/utils/assertInquiryPermission';
import { resolveInquiry } from '#/modules/inquiry/services/resolution';

export const inquiryResolveController = makeController(inquiryResolveRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const permix = c.get('permix');
  const { id } = c.req.valid('param');
  const { outcome, ...resolutionData } = c.req.valid('json');

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  if (!inquiry) throw makeError({ status: 404, message: 'Inquiry not found', requestId: c.get('requestId') });
  if (![InquiryStatus.sent, InquiryStatus.changesRequested].includes(inquiry.status)) {
    throw makeError({ status: 400, message: 'Inquiry must be sent or changes requested to resolve', requestId: c.get('requestId') });
  }

  await assertInquiryPermission(db, permix, inquiry as unknown as HydratedRecord, 'resolve', c.get('requestId'));

  const resolved = await resolveInquiry(db, inquiry, outcome, resolutionData, user.id);

  return respond.ok(resolved);
});
