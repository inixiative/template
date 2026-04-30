import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminContactReadManyRoute } from '#/modules/contact/routes/adminContactReadMany';

export const adminContactReadManyController = makeController(
  adminContactReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.contact);
    return respond.ok(data, { pagination });
  },
);
