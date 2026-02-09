import { Prisma } from '@template/db';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManySpacesRoute } from '#/modules/me/routes/meReadManySpaces';

type SpaceWithUsers = Prisma.SpaceGetPayload<{
  include: {
    organization: true;
    spaceUsers: { include: { organizationUser: true } };
  };
}>;

export const meReadManySpacesController = makeController(meReadManySpacesRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');

  const { data: spaces, pagination } = await paginate<typeof db.space, SpaceWithUsers>(c, db.space, {
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
  });

  const data = spaces.map(({ spaceUsers: [{ organizationUser, ...spaceUser }], ...space }) => ({
    ...space,
    spaceUser,
    organizationUser,
  }));

  return respond.ok(data, { pagination });
});
