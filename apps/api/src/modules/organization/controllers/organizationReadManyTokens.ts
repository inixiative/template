import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManyTokensRoute } from '#/modules/organization/routes/organizationReadManyTokens';

export const organizationReadManyTokensController = makeController(
  organizationReadManyTokensRoute,
  async (c, respond) => {
    const db = c.get('db');
    const org = getResource<'organization'>(c);

    const { data, pagination } = await paginate(c, db.token, {
      where: { organizationId: org.id },
      omit: { keyHash: true },
    });

    return respond.ok(data, { pagination });
  },
);
