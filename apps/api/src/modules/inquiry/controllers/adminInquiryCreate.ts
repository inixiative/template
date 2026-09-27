/**
 * @atlas
 * @kind controller
 * @partOf feature:inquiry, superadmin
 * @uses primitive:routeTemplates
 */
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { adminInquiryCreateRoute } from '#/modules/inquiry/routes/adminInquiryCreate';
import { createInquiry } from '#/modules/inquiry/services/createInquiry';

export const adminInquiryCreateController = makeController(adminInquiryCreateRoute, async (c, respond) => {
  const inquiry = await createInquiry(c, { sourceModel: InquiryResourceModel.admin });
  return respond.created(inquiry);
});
