import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminSpaceReadManyRoute } from '#/modules/space/routes/adminSpaceReadMany';

export const adminSpaceReadManyController = makeController(adminSpaceReadManyRoute, async (c, respond) => {
  const db = c.get('db');
  const { page, pageSize, search, deleted, organizationId } = c.req.valid('query');

  const where = {
    deletedAt: deleted === 'true' ? { not: null } : deleted === 'false' ? null : undefined,
    organizationId: organizationId || undefined,
    OR: search ? [{ name: { contains: search } }, { slug: { contains: search } }] : undefined,
  };

  const { data, pagination } = await paginate(
    db.space,
    { where, orderBy: { createdAt: 'desc' } },
    { page, pageSize },
  );

  return respond.ok(data, { pagination });
});
