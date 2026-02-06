
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyOrganizationsRoute } from '#/modules/me/routes/meReadManyOrganizations';

export const meReadManyOrganizationsController = makeController(meReadManyOrganizationsRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');

  const { data: orgs, pagination } = await paginate(c, db.organization, {
    where: {
      deletedAt: null,
      organizationUsers: { some: { userId: user.id } },
    },
    include: { organizationUsers: { where: { userId: user.id } } },
  });

  const data = orgs.map(({ organizationUsers, ...org }) => ({
    ...org,
    organizationUser: organizationUsers[0],
  }));

  return respond.ok(data, { pagination });
});
