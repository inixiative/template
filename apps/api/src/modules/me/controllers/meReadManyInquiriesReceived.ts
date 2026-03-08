import { InquiryResourceModel, InquiryStatus } from '@template/db/generated/client/enums';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyInquiriesReceivedRoute } from '#/modules/me/routes/meReadManyInquiriesReceived';

export const meReadManyInquiriesReceivedController = makeController(
  meReadManyInquiriesReceivedRoute,
  async (c, respond) => {
    const user = c.get('user')!;
    const db = c.get('db');

    const { data, pagination } = await paginate(c, db.inquiry, {
      where: {
        targetModel: InquiryResourceModel.User,
        targetUserId: user.id,
        status: { not: InquiryStatus.draft },
      },
      orderBy: { createdAt: 'desc' },
      include: { sourceUser: true, sourceOrganization: true, sourceSpace: true },
    });

    return respond.ok(data, { pagination });
  },
);
