import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminInquiryReadManyRoute } from '#/modules/inquiry/routes/adminInquiryReadMany';

export const adminInquiryReadManyController = makeController(adminInquiryReadManyRoute, async (c, respond) => {
  const db = c.get('db');

  const { data, pagination } = await paginate(c, db.inquiry, {
    include: {
      sourceUser: true,
      sourceOrganization: true,
      sourceSpace: true,
      targetUser: true,
      targetOrganization: true,
      targetSpace: true,
    },
  });

  return respond.ok(data, { pagination });
});
