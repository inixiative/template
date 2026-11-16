/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 */
import { whereAxisIsOwnerOrItsDelegate } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquiryReceived } from '#/modules/inquiry/queries/inquiryIncludes';
import { organizationReadManyInquiriesReceivedRoute } from '#/modules/organization/routes/organizationReadManyInquiriesReceived';

export const organizationReadManyInquiriesReceivedController = makeController(
  organizationReadManyInquiriesReceivedRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.inquiry, {
      where: {
        ...whereAxisIsOwnerOrItsDelegate('Inquiry', 'targetModel', {
          organizationId: getResource<'organization'>(c).id,
          spaceId: null,
          userId: null,
        }),
        status: { notIn: [InquiryStatus.draft, InquiryStatus.canceled] },
      },
      orNullFields: ['expiresAt'],
      orderBy: { createdAt: 'desc' },
      include: includeInquiryReceived,
    });
    return respond.ok(data, { pagination });
  },
);
