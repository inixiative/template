import { InquiryResourceModel, InquiryStatus } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyInquiriesReceivedRoute } from '#/modules/space/routes/spaceReadManyInquiriesReceived';

export const spaceReadManyInquiriesReceivedController = makeController(
  spaceReadManyInquiriesReceivedRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = getResource<'space'>(c);

    const { data, pagination } = await paginate(c, db.inquiry, {
      where: {
        targetModel: InquiryResourceModel.Space,
        targetSpaceId: space.id,
        status: { not: InquiryStatus.draft },
      },
      orderBy: { createdAt: 'desc' },
      include: { sourceUser: true, sourceOrganization: true, sourceSpace: true },
    });

    return respond.ok(data, { pagination });
  },
);
