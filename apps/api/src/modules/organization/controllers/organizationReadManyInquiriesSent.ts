/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 */
import { whereAxisIsOwnerOrItsDelegate } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquirySent } from '#/modules/inquiry/queries/inquiryIncludes';
import { organizationReadManyInquiriesSentRoute } from '#/modules/organization/routes/organizationReadManyInquiriesSent';

export const organizationReadManyInquiriesSentController = makeController(
  organizationReadManyInquiriesSentRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.inquiry, {
      where: {
        ...whereAxisIsOwnerOrItsDelegate('Inquiry', 'sourceModel', {
          organizationId: getResource<'organization'>(c).id,
          spaceId: null,
          userId: null,
        }),
      },
      orNullFields: ['expiresAt'],
      orderBy: { createdAt: 'desc' },
      include: includeInquirySent,
    });
    return respond.ok(data, { pagination });
  },
);
