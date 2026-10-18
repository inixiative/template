/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, feature:inquiry
 */
import { makeController } from '#/lib/utils/makeController';
import { createInquiry } from '#/modules/inquiry/services/createInquiry';
import { resolveInquirySource } from '#/modules/inquiry/services/resolveInquirySource';
import { integrationCreateInquiryRoute } from '#/modules/integration/routes/integrationCreateInquiry';

export const integrationCreateInquiryController = makeController(
  integrationCreateInquiryRoute,
  async (c, respond) => {
    const inquiry = await createInquiry(c, resolveInquirySource(c));
    return respond.created(inquiry);
  },
);
