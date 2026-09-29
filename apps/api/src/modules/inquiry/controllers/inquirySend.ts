/**
 * @atlas
 * @kind controller
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquirySendRoute } from '#/modules/inquiry/routes/inquirySend';
import { sendInquiry } from '#/modules/inquiry/services/sendInquiry';

export const inquirySendController = makeController(inquirySendRoute, async (c, respond) => {
  const sent = await sendInquiry(c, getResource<'inquiry'>(c));
  return respond.ok(sent);
});
