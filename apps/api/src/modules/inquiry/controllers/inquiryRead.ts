import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { attachInquiryAuditLogs, includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
import { inquiryReadRoute } from '#/modules/inquiry/routes/inquiryRead';

export const inquiryReadController = makeController(inquiryReadRoute, async (c, respond) => {
  const db = c.get('db');
  const inquiry = getResource<'inquiry'>(c);
  const hydratedInquiry = await db.inquiry.findUniqueOrThrow({
    where: { id: inquiry.id },
    include: includeInquiryResponse,
  });
  return respond.ok(await attachInquiryAuditLogs(db, hydratedInquiry));
});
