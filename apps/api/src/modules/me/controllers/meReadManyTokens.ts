import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyTokensRoute } from '#/modules/me/routes/meReadManyTokens';

export const meReadManyTokensController = makeController(meReadManyTokensRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');

  const { data, pagination } = await paginate(c, db.token, {
    where: {
      userId: user.id,
      ownerModel: { in: ['User', 'OrganizationUser', 'SpaceUser'] },
    },
    include: {
      organization: true,
      organizationUser: true,
      space: true,
      spaceUser: true,
    },
    omit: { keyHash: true },
  });

  return respond.ok(data, { pagination });
});
