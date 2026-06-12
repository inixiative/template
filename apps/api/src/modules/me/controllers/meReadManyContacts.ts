import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyContactsRoute } from '#/modules/me/routes/meReadManyContacts';

export const meReadManyContactsController = makeController(meReadManyContactsRoute, async (c, respond) => {
  const db = c.get('db');
  const { data, pagination } = await paginate(c, db.contact, {
    where: { deletedAt: null, userId: c.get('user')!.id },
  });
  return respond.ok(data, { pagination });
});
