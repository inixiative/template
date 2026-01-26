import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManyOrganizationUserRoute } from '#/modules/organization/routes/organizationReadManyOrganizationUser';

export const organizationReadManyOrganizationUserController = makeController(
  organizationReadManyOrganizationUserRoute,
  async (c, respond) => {
    const db = c.get('db');
    const org = getResource<'organization'>(c);
    const { page, pageSize } = c.req.valid('query');

    const { data, pagination } = await paginate(
      db.organizationUser,
      {
        where: { organizationId: org.id },
        include: { user: true },
      },
      { page, pageSize },
    );

    return respond.ok(data, { pagination });
  },
);
