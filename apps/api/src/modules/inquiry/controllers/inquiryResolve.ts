import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryResolveRoute } from '#/modules/inquiry/routes/inquiryResolve';
import { resolveInquiry } from '#/modules/inquiry/services/resolution';
import { validateInquiryIsResolvable } from '#/modules/inquiry/validations/validateInquiryStatus';

export const inquiryResolveController = makeController(inquiryResolveRoute, async (c, respond) => {
  const inquiry = getResource<'inquiry'>(c);
  const { status, ...resolutionData } = c.req.valid('json');

  validateInquiryIsResolvable(inquiry);

  const resolved = await resolveInquiry(c, inquiry, status, resolutionData);
  return respond.ok(resolved);
});
