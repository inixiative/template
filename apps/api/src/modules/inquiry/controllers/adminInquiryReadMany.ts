import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminInquiryReadManyRoute } from '#/modules/inquiry/routes/adminInquiryReadMany';

export const adminInquiryReadManyController = makeController(adminInquiryReadManyRoute, async (c, respond) => {
  const db = c.get('db');

  const { data, pagination } = await paginate(c, db.inquiry);

  return respond.ok(data, { pagination });
});
