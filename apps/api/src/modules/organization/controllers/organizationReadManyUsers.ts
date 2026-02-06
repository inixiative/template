import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManyUsersRoute } from '#/modules/organization/routes/organizationReadManyUsers';

export const organizationReadManyUsersController = makeController(
  organizationReadManyUsersRoute,
  async (c, respond) => {
    const db = c.get('db');
    const org = getResource<'organization'>(c);

    const { data: users, pagination } = await paginate(c, db.user, {
      where: { organizationUsers: { some: { organizationId: org.id } } },
      include: { organizationUsers: { where: { organizationId: org.id } } },
    });

    const data = users.map(({ organizationUsers, ...user }) => ({
      ...user,
      organizationUser: organizationUsers[0],
    }));

    return respond.ok(data, { pagination });
  },
);
