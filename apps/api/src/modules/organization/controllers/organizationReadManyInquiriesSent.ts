import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquirySent } from '#/modules/inquiry/queries/inquiryIncludes';
import { organizationReadManyInquiriesSentRoute } from '#/modules/organization/routes/organizationReadManyInquiriesSent';

export const organizationReadManyInquiriesSentController = makeController(
  organizationReadManyInquiriesSentRoute,
  async (c, respond) => {
    const db = c.get('db');
    const org = getResource<'organization'>(c);

    const { data, pagination } = await paginate(c, db.inquiry, {
      where: { sourceModel: InquiryResourceModel.Organization, sourceOrganizationId: org.id },
      orderBy: { createdAt: 'desc' },
      include: includeInquirySent,
    });

    return respond.ok(data, { pagination });
  },
);
