import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryResolveRoute } from '#/modules/inquiry/routes/inquiryResolve';
import { resolveInquiry } from '#/modules/inquiry/services/resolution';

export const inquiryResolveController = makeController(inquiryResolveRoute, async (c, respond) => {
  const inquiry = getResource<'inquiry'>(c);
  const { status, ...resolutionData } = c.req.valid('json');

  // validateInquiryIsResolvable runs inside resolveInquiry's txn against a
  // fresh read of the row — moved there to avoid a TOCTOU window where two
  // concurrent resolves both pass the pre-txn status check.
  const resolved = await resolveInquiry(c, inquiry, status, resolutionData);
  return respond.ok(resolved);
});
