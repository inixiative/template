import { InquiryResourceModel, InquiryStatus } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { attachInquiryAuditLogList, includeInquiryReceived } from '#/modules/inquiry/queries/inquiryIncludes';
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
      include: includeInquiryReceived,
    });

    return respond.ok(await attachInquiryAuditLogList(db, data), { pagination });
  },
);
