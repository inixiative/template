import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManyTokenRoute } from '#/modules/organization/routes/organizationReadManyToken';

export const organizationReadManyTokenController = makeController(
  organizationReadManyTokenRoute,
  async (c, respond) => {
    const db = c.get('db');
    const org = getResource<'organization'>(c);
    const { page, pageSize } = c.req.valid('query');

    const { data, pagination } = await paginate(
      db.token,
      {
        where: { organizationId: org.id },
        omit: { keyHash: true },
      },
      { page, pageSize },
    );

    return respond.ok(data, { pagination });
  },
);
