import { getUser } from '#/lib/context/getUser';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyProviderRoute } from '#/modules/me/routes/meReadManyProvider';

export const meReadManyProviderController = makeController(meReadManyProviderRoute, async (c, respond) => {
  const user = getUser(c)!;
  const db = c.get('db');
  const { page, pageSize, providerModel, providerSpaceId, providerOrganizationId } = c.req.valid('query');

  const { data, pagination } = await paginate(
    db.customerRef,
    {
      where: {
        customerModel: 'User',
        customerUserId: user.id,
        ...(providerModel && { providerModel }),
        ...(providerSpaceId && { providerSpaceId }),
        // TODO: OR: [{ organizationId }, { providerSpace: { organizationId } }] when we add denormalized orgId
        ...(providerOrganizationId && { providerSpace: { organizationId: providerOrganizationId } }),
      },
      include: {
        providerSpace: {
          include: { organization: true },
        },
      },
    },
    { page, pageSize },
  );

  return respond.ok(data, { pagination });
});
