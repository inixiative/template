/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:inquiry
 */
import { makeController } from '#/lib/utils/makeController';
import { createInquiry } from '#/modules/inquiry/services/createInquiry';
import { resolveInquirySource } from '#/modules/inquiry/services/resolveInquirySource';
import { meCreateInquiryRoute } from '#/modules/me/routes/meCreateInquiry';

export const meCreateInquiryController = makeController(meCreateInquiryRoute, async (c, respond) => {
  const inquiry = await createInquiry(c, resolveInquirySource(c));
  return respond.created(inquiry);
});
