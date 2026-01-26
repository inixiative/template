import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminInquiryReadManyRoute } from '#/modules/inquiry/routes/adminInquiryReadMany';

export const adminInquiryReadManyController = makeController(adminInquiryReadManyRoute, async (c, respond) => {
  const db = c.get('db');
  const { page, pageSize, type, status } = c.req.valid('query');

  const where = {
    ...(type && { type }),
    ...(status && { status }),
  };

  const { data, pagination } = await paginate(
    db.inquiry,
    { where, orderBy: { createdAt: 'desc' } },
    { page, pageSize },
  );

  return respond.ok(data, { pagination });
});
