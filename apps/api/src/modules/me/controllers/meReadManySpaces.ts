/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:tenancy
 */
import type { Prisma } from '@template/db';
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
    // The membership filter needs its own live-row scope: paginate injects
    // `deletedAt: null` into the lens visits and the include tree, but caller
    // where subtrees are the caller's own — without it a soft-deleted spaceUser
    // would match `some` while the include filters it out.
    where: {
      spaceUsers: { some: { userId: user.id, deletedAt: null } },
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
