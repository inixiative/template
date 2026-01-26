import { getUser } from '#/lib/context/getUser';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyTokenRoute } from '#/modules/me/routes/meReadManyToken';

export const meReadManyTokenController = makeController(meReadManyTokenRoute, async (c, respond) => {
  const user = getUser(c)!;
  const db = c.get('db');
  const { page, pageSize } = c.req.valid('query');

  const { data, pagination } = await paginate(
    db.token,
    {
      where: {
        userId: user.id,
        ownerModel: { in: ['User', 'OrganizationUser'] },
      },
      include: {
        organization: true,
        organizationUser: true,
      },
      omit: { keyHash: true },
    },
    { page, pageSize },
  );

  return respond.ok(data, { pagination });
});
