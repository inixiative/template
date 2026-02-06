import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManySpacesRoute } from '#/modules/organization/routes/organizationReadManySpaces';

export const organizationReadManySpacesController = makeController(
  organizationReadManySpacesRoute,
  async (c, respond) => {
    const db = c.get('db');
    const org = getResource<'organization'>(c);

    const { data, pagination } = await paginate(c, db.space, {
      where: { organizationId: org.id },
    });

    return respond.ok(data, { pagination });
  },
);
