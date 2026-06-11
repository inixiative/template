/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:inquiry
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquiryReceived } from '#/modules/inquiry/queries/inquiryIncludes';
import { meReadManyInquiriesReceivedRoute } from '#/modules/me/routes/meReadManyInquiriesReceived';

export const meReadManyInquiriesReceivedController = makeController(
  meReadManyInquiriesReceivedRoute,
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
