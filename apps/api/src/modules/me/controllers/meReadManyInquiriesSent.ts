import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeInquirySent } from '#/modules/inquiry/queries/inquiryIncludes';
import { meReadManyInquiriesSentRoute } from '#/modules/me/routes/meReadManyInquiriesSent';

export const meReadManyInquiriesSentController = makeController(meReadManyInquiriesSentRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');

  const { data, pagination } = await paginate(c, db.inquiry, {
    orNullFields: ['expiresAt'],
    where: { sourceModel: InquiryResourceModel.User, sourceUserId: user.id },
    orderBy: { createdAt: 'desc' },
    include: includeInquirySent,
  });

  return respond.ok(data, { pagination });
});
