import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryResolveRoute } from '#/modules/inquiry/routes/inquiryResolve';
import { resolveInquiry } from '#/modules/inquiry/services/resolution';

export const inquiryResolveController = makeController(inquiryResolveRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const inquiry = getResource<'inquiry'>(c);
  const { outcome, ...resolutionData } = c.req.valid('json');

  if (![InquiryStatus.sent, InquiryStatus.changesRequested].includes(inquiry.status)) {
    throw makeError({ status: 400, message: 'Inquiry must be sent or changes requested to resolve', requestId: c.get('requestId') });
  }

  const resolved = await resolveInquiry(db, inquiry, outcome, resolutionData, user.id);

  return respond.ok(resolved);
});
