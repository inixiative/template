/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 */
import { wherePolymorphicSideIsOneOf } from '@template/db';
import { contextResource } from '#/lib/context/contextResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
import { spaceReadManyInquiriesSentRoute } from '#/modules/space/routes/spaceReadManyInquiriesSent';

export const spaceReadManyInquiriesSentController = makeController(
  spaceReadManyInquiriesSentRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = contextResource<'space'>(c);
    const { data, pagination } = await paginate(c, db.inquiry, {
      where: {
        ...wherePolymorphicSideIsOneOf('Inquiry', 'sourceModel', [
          {
            ownerKeys: {
              Organization: space.organizationId,
              Space: space.id,
              User: null,
            },
          },
        ]),
      },
      orNullFields: ['expiresAt'],
      orderBy: { createdAt: 'desc' },
      include: includeInquiryResponse,
    });
    return respond.ok(data, { pagination });
  },
);
