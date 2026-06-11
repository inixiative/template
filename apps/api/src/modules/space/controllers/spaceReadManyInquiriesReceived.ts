/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:inquiry
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquiryReceived } from '#/modules/inquiry/queries/inquiryIncludes';
import { spaceReadManyInquiriesReceivedRoute } from '#/modules/space/routes/spaceReadManyInquiriesReceived';

export const spaceReadManyInquiriesReceivedController = makeController(
  spaceReadManyInquiriesReceivedRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.inquiry, {
      orNullFields: ['expiresAt'],
      orderBy: { createdAt: 'desc' },
      include: includeInquiryReceived,
    });
    return respond.ok(data, { pagination });
  },
);
