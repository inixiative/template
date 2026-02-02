import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyCustomerRoute } from '#/modules/space/routes/spaceReadManyCustomer';

export const spaceReadManyCustomerController = makeController(spaceReadManyCustomerRoute, async (c, respond) => {
  const db = c.get('db');
  const space = getResource<'space'>(c);
  const { page, pageSize } = c.req.valid('query');

  const { data, pagination } = await paginate(
    db.customerRef,
    {
      where: { providerSpaceId: space.id },
      include: {
        customerUser: true,
        customerOrganization: true,
        customerSpace: { include: { organization: true } },
      },
    },
    { page, pageSize },
  );

  return respond.ok(data, { pagination });
});
