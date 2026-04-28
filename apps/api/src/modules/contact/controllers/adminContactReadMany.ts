import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminContactReadManyRoute } from '#/modules/contact/routes/adminContactReadMany';

export const adminContactReadManyController = makeController(
  adminContactReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { ownerModel, userId, organizationId, spaceId, type, isPrimary, isPublic } = c.req.valid('query');

    const { data, pagination } = await paginate(c, db.contact, {
      where: {
        deletedAt: null,
        ...(ownerModel && { ownerModel }),
        ...(userId && { userId }),
        ...(organizationId && { organizationId }),
        ...(spaceId && { spaceId }),
        ...(type && { type }),
        ...(isPrimary !== undefined && { isPrimary }),
        ...(isPublic !== undefined && { isPublic }),
      },
    });

    return respond.ok(data, { pagination });
  },
);
