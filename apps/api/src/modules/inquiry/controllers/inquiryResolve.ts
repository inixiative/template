import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
import { inquiryResolveRoute } from '#/modules/inquiry/routes/inquiryResolve';
import { resolveInquiry } from '#/modules/inquiry/services/resolution';
import { validateInquiryIsResolvable } from '#/modules/inquiry/validations/validateInquiryStatus';

export const inquiryResolveController = makeController(inquiryResolveRoute, async (c, respond) => {
  const db = c.get('db');
  const inquiry = getResource<'inquiry'>(c);
  const { status, ...resolutionData } = c.req.valid('json');

  validateInquiryIsResolvable(inquiry);

  await resolveInquiry(c, inquiry, status, resolutionData);
  const resolved = await db.inquiry.findUniqueOrThrow({
    where: { id: inquiry.id },
    include: includeInquiryResponse,
  });

  return respond.ok(resolved);
});
