import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { inquiryReadRoute } from '#/modules/inquiry/routes/inquiryRead';

export const inquiryReadController = makeController(inquiryReadRoute, async (c, respond) => {
  const inquiry = getResource<'inquiry'>(c);
  return respond.ok(inquiry);
});
