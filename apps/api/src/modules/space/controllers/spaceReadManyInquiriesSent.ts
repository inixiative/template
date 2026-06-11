/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:inquiry
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquirySent } from '#/modules/inquiry/queries/inquiryIncludes';
import { spaceReadManyInquiriesSentRoute } from '#/modules/space/routes/spaceReadManyInquiriesSent';

export const spaceReadManyInquiriesSentController = makeController(
  spaceReadManyInquiriesSentRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.inquiry, {
      orNullFields: ['expiresAt'],
      orderBy: { createdAt: 'desc' },
      include: includeInquirySent,
    });
    return respond.ok(data, { pagination });
  },
);
