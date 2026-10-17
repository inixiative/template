/**
 * @atlas
 * @kind controller
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryResolveRoute } from '#/modules/inquiry/routes/inquiryResolve';
import { resolveInquiry } from '#/modules/inquiry/services/resolution';

export const inquiryResolveController = makeController(inquiryResolveRoute, async (c, respond) => {
  const inquiry = getResource<'inquiry'>(c);
  const { status, expectedUpdatedAt, ...resolutionData } = c.req.valid('json');

  const resolved = await resolveInquiry(c, inquiry, status, resolutionData, expectedUpdatedAt);
  return respond.ok(resolved);
});
