import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyInquiriesSentRoute } from '#/modules/space/routes/spaceReadManyInquiriesSent';

export const spaceReadManyInquiriesSentController = makeController(
  spaceReadManyInquiriesSentRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = getResource<'space'>(c);

    const { data, pagination } = await paginate(c, db.inquiry, {
      where: { sourceModel: InquiryResourceModel.Space, sourceSpaceId: space.id },
      orderBy: { createdAt: 'desc' },
    });

    return respond.ok(data, { pagination });
  },
);
