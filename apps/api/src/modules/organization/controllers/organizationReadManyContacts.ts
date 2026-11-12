/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 */
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManyContactsRoute } from '#/modules/organization/routes/organizationReadManyContacts';

export const organizationReadManyContactsController = makeController(
  organizationReadManyContactsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.contact, {
      where: submodelOwnerWhere(c),
    });
    return respond.ok(data, { pagination });
  },
);
