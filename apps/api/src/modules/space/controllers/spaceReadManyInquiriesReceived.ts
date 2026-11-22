/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 */
import { wherePolymorphicSideIsOneOf } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { contextResource } from '#/lib/context/contextResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
import { spaceReadManyInquiriesReceivedRoute } from '#/modules/space/routes/spaceReadManyInquiriesReceived';

export const spaceReadManyInquiriesReceivedController = makeController(
  spaceReadManyInquiriesReceivedRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = contextResource<'space'>(c);
    const { data, pagination } = await paginate(c, db.inquiry, {
      where: {
        ...wherePolymorphicSideIsOneOf('Inquiry', 'targetModel', [
          {
            ownerKeys: {
              Organization: space.organizationId,
              Space: space.id,
              User: null,
            },
          },
        ]),
        status: { notIn: [InquiryStatus.draft, InquiryStatus.canceled] },
      },
      orNullFields: ['expiresAt'],
      orderBy: { createdAt: 'desc' },
      include: includeInquiryResponse,
    });
    return respond.ok(data, { pagination });
  },
);
