import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManyContactsRoute } from '#/modules/organization/routes/organizationReadManyContacts';

export const organizationReadManyContactsController = makeController(
  organizationReadManyContactsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = getResource<'organization'>(c);
    const { data, pagination } = await paginate(c, db.contact, {
      where: { organizationId: organization.id, deletedAt: null },
    });
    return respond.ok(data, { pagination });
  },
);
