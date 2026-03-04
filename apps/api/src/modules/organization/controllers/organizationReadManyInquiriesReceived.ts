import { InquiryResourceModel, InquiryStatus } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManyInquiriesReceivedRoute } from '#/modules/organization/routes/organizationReadManyInquiriesReceived';

export const organizationReadManyInquiriesReceivedController = makeController(
  organizationReadManyInquiriesReceivedRoute,
  async (c, respond) => {
    const db = c.get('db');
    const org = getResource<'organization'>(c);

    const { data, pagination } = await paginate(c, db.inquiry, {
      where: {
        targetModel: InquiryResourceModel.Organization,
        targetOrganizationId: org.id,
        status: { not: InquiryStatus.draft },
      },
      orderBy: { createdAt: 'desc' },
    include: { sourceUser: true, sourceOrganization: true, sourceSpace: true },
    });

    return respond.ok(data, { pagination });
  },
);
