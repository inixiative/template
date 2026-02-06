import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyCustomersRoute } from '#/modules/space/routes/spaceReadManyCustomers';

export const spaceReadManyCustomersController = makeController(spaceReadManyCustomersRoute, async (c, respond) => {
  const db = c.get('db');
  const space = getResource<'space'>(c);

  const { data, pagination } = await paginate(c, db.customerRef, {
    where: { providerSpaceId: space.id },
    include: {
      customerUser: true,
      customerOrganization: true,
      customerSpace: { include: { organization: true } },
    },
  });

  return respond.ok(data, { pagination });
});
