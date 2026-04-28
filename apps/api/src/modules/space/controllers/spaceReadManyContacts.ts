import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyContactsRoute } from '#/modules/space/routes/spaceReadManyContacts';

export const spaceReadManyContactsController = makeController(
  spaceReadManyContactsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = getResource<'space'>(c);
    const { data, pagination } = await paginate(c, db.contact, {
      where: { spaceId: space.id, deletedAt: null },
    });
    return respond.ok(data, { pagination });
  },
);
