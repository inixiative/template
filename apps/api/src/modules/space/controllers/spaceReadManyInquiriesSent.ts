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
import { spaceReadManyInquiriesSentRoute } from '#/modules/space/routes/spaceReadManyInquiriesSent';

export const spaceReadManyInquiriesSentController = makeController(
  spaceReadManyInquiriesSentRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = getResource<'space'>(c);
    const { data, pagination } = await paginate(c, db.inquiry, {
      where: {
        ...whereAxisCarriesOwnerKeys('Inquiry', 'sourceModel', {
          Organization: space.organizationId,
          Space: space.id,
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
