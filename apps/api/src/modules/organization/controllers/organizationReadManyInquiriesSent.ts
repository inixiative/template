/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 */
import { whereAxisCarriesOwnerKeys } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
import { organizationReadManyInquiriesSentRoute } from '#/modules/organization/routes/organizationReadManyInquiriesSent';

export const organizationReadManyInquiriesSentController = makeController(
  organizationReadManyInquiriesSentRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.inquiry, {
      where: {
        ...whereAxisCarriesOwnerKeys('Inquiry', 'sourceModel', {
          Organization: getResource<'organization'>(c).id,
          Space: null,
          User: null,
        }),
      },
      orNullFields: ['expiresAt'],
      orderBy: { createdAt: 'desc' },
      include: includeInquiryResponse,
    });
    return respond.ok(data, { pagination });
  },
);
