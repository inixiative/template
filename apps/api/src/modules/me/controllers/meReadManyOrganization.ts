import { getUser } from '#/lib/context/getUser';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyOrganizationRoute } from '#/modules/me/routes/meReadManyOrganization';

export const meReadManyOrganizationController = makeController(meReadManyOrganizationRoute, async (c, respond) => {
  const user = getUser(c)!;
  const db = c.get('db');
  const { page, pageSize } = c.req.valid('query');

  const { data: orgs, pagination } = await paginate(
    db.organization,
    {
      where: {
        deletedAt: null,
        organizationUsers: { some: { userId: user.id } },
      },
      include: { organizationUsers: { where: { userId: user.id } } },
    },
    { page, pageSize },
  );

  const data = orgs.map(({ organizationUsers, ...org }) => ({
    ...org,
    organizationUser: organizationUsers[0],
  }));

  return respond.ok(data, { pagination });
});
