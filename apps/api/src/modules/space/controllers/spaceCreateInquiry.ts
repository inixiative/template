/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:inquiry
 */
import { makeController } from '#/lib/utils/makeController';
import { createInquiry } from '#/modules/inquiry/services/createInquiry';
import { resolveInquirySource } from '#/modules/inquiry/services/resolveInquirySource';
import { spaceCreateInquiryRoute } from '#/modules/space/routes/spaceCreateInquiry';

export const spaceCreateInquiryController = makeController(spaceCreateInquiryRoute, async (c, respond) => {
  const inquiry = await createInquiry(c, resolveInquirySource(c));
  return respond.created(inquiry);
});
