import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminOrganizationReadManyRoute } from '#/modules/organization/routes/adminOrganizationReadMany';

export const adminOrganizationReadManyController = makeController(
  adminOrganizationReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { page, pageSize, search, deleted } = c.req.valid('query');

    const where = {
      deletedAt: deleted === 'true' ? { not: null } : deleted === 'false' ? null : undefined,
      OR: search ? [{ name: { contains: search } }, { slug: { contains: search } }] : undefined,
    };

    const { data, pagination } = await paginate(
      db.organization,
      { where, orderBy: { createdAt: 'desc' } },
      { page, pageSize },
    );

    return respond.ok(data, { pagination });
  },
);
