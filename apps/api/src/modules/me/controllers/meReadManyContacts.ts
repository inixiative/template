/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:contact
 */

import { me } from '#/lib/context/me';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyContactsRoute } from '#/modules/me/routes/meReadManyContacts';

export const meReadManyContactsController = makeController(
  meReadManyContactsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.contact, {
      where: { userId: me(c)!.id },
    });
    return respond.ok(data, { pagination });
  },
);
