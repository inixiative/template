import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManySpaceRoute } from '#/modules/organization/routes/organizationReadManySpace';

export const organizationReadManySpaceController = makeController(
  organizationReadManySpaceRoute,
  async (c, respond) => {
    const db = c.get('db');
    const org = getResource<'organization'>(c);
    const { page, pageSize } = c.req.valid('query');

    const { data, pagination } = await paginate(
      db.space,
      { where: { organizationId: org.id } },
      { page, pageSize },
    );

    return respond.ok(data, { pagination });
  },
);
