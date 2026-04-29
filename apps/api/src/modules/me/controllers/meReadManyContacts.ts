import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyContactsRoute } from '#/modules/me/routes/meReadManyContacts';

export const meReadManyContactsController = makeController(
  meReadManyContactsRoute,
  async (c, respond) => {
    const user = c.get('user')!;
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.contact, {
      where: { userId: user.id, deletedAt: null },
    });
    return respond.ok(data, { pagination });
  },
);
