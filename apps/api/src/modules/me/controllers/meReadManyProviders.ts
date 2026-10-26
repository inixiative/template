/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:customer
 */

import { me } from '#/lib/context/me';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeProvider } from '#/modules/customerRef/queries/customerRefIncludes';
import { meReadManyProvidersRoute } from '#/modules/me/routes/meReadManyProviders';

export const meReadManyProvidersController = makeController(
  meReadManyProvidersRoute,
  async (c, respond) => {
    const user = me(c)!;
    const db = c.get('db');
    const { providerModel, providerSpaceId, providerOrganizationId } = c.req.valid('query');

    const { data, pagination } = await paginate(c, db.customerRef, {
      where: {
        customerModel: 'User',
        customerUserId: user.id,
        ...(providerModel && { providerModel }),
        ...(providerSpaceId && { providerSpaceId }),
        ...(providerOrganizationId && {
          providerSpace: { organizationId: providerOrganizationId },
        }),
      },
      include: includeProvider,
    });

    return respond.ok(data, { pagination });
  },
);
