/**
 * @atlas
 * @kind controller
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { inquirySendRoute } from '#/modules/inquiry/routes/inquirySend';
import { sendInquiry } from '#/modules/inquiry/services/sendInquiry';

export const inquirySendController = makeController(inquirySendRoute, async (c, respond) => {
  const sent = await sendInquiry(
    c,
    contextResource<'inquiry'>(c),
    c.req.valid('json').expectedUpdatedAt,
  );
  return respond.ok(sent);
});
