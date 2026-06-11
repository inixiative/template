/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyContactsRoute } from '#/modules/space/routes/spaceReadManyContacts';

export const spaceReadManyContactsController = makeController(spaceReadManyContactsRoute, async (c, respond) => {
  const db = c.get('db');
  const { data, pagination } = await paginate(c, db.contact);
  return respond.ok(data, { pagination });
});
