import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyInquiriesSentRoute } from '#/modules/me/routes/meReadManyInquiriesSent';

export const meReadManyInquiriesSentController = makeController(meReadManyInquiriesSentRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');

  const { data, pagination } = await paginate(c, db.inquiry, {
    where: { sourceModel: InquiryResourceModel.User, sourceUserId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { targetUser: true, targetOrganization: true, targetSpace: true },
  });

  return respond.ok(data, { pagination });
});
