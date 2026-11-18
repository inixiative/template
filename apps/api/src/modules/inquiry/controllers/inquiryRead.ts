/**
 * @atlas
 * @kind controller
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryReadRoute } from '#/modules/inquiry/routes/inquiryRead';

export const inquiryReadController = makeController(inquiryReadRoute, async (c, respond) => {
  return respond.ok(contextResource<'inquiry'>(c));
});
