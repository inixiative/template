import { getUser } from '#/lib/context/getUser';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManySpaceRoute } from '#/modules/me/routes/meReadManySpace';

export const meReadManySpaceController = makeController(meReadManySpaceRoute, async (c, respond) => {
  const user = getUser(c)!;
  const db = c.get('db');
  const { page, pageSize } = c.req.valid('query');

  const { data: spaces, pagination } = await paginate(
    db.space,
    {
      where: {
        deletedAt: null,
        spaceUsers: { some: { userId: user.id } },
      },
      include: {
        organization: true,
        spaceUsers: {
          where: { userId: user.id },
          include: { organizationUser: true },
        },
      },
    },
    { page, pageSize },
  );

  const data = spaces.map(({ spaceUsers: [{ organizationUser, ...spaceUser }], ...space }) => ({
    ...space,
    spaceUser,
    organizationUser,
  }));

  return respond.ok(data, { pagination });
});
