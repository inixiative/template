
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyProvidersRoute } from '#/modules/me/routes/meReadManyProviders';

export const meReadManyProvidersController = makeController(meReadManyProvidersRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const { providerModel, providerSpaceId, providerOrganizationId } = c.req.valid('query');

  const { data, pagination } = await paginate(c, db.customerRef, {
    where: {
      customerModel: 'User',
      customerUserId: user.id,
      ...(providerModel && { providerModel }),
      ...(providerSpaceId && { providerSpaceId }),
      ...(providerOrganizationId && { providerSpace: { organizationId: providerOrganizationId } }),
    },
    include: {
      providerSpace: {
        include: { organization: true },
      },
    },
  });

  return respond.ok(data, { pagination });
});
