import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminOrganizationReadManyRoute } from '#/modules/organization/routes/adminOrganizationReadMany';

export const adminOrganizationReadManyController = makeController(
  adminOrganizationReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { deleted } = c.req.valid('query');

    const { data, pagination } = await paginate(c, db.organization, {
      where: {
        deletedAt: deleted === 'true' ? { not: null } : deleted === 'false' ? null : undefined,
      },
    });

    return respond.ok(data, { pagination });
  },
);
