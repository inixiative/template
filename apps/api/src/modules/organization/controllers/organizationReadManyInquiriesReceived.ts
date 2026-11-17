/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 */
import { whereAxisCarriesOwnerKeys } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
import { organizationReadManyInquiriesReceivedRoute } from '#/modules/organization/routes/organizationReadManyInquiriesReceived';

export const organizationReadManyInquiriesReceivedController = makeController(
  organizationReadManyInquiriesReceivedRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.inquiry, {
      where: {
        ...whereAxisCarriesOwnerKeys('Inquiry', 'targetModel', {
          organizationId: getResource<'organization'>(c).id,
          spaceId: null,
          userId: null,
        }),
        status: { notIn: [InquiryStatus.draft, InquiryStatus.canceled] },
      },
      orNullFields: ['expiresAt'],
      orderBy: { createdAt: 'desc' },
      include: includeInquiryResponse,
    });
    return respond.ok(data, { pagination });
  },
);
