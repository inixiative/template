import { getUser } from '#/lib/context/getUser';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyOrganizationRoute } from '#/modules/me/routes/meReadManyOrganization';

export const meReadManyOrganizationController = makeController(meReadManyOrganizationRoute, async (c, respond) => {
  const user = getUser(c)!;
  const db = c.get('db');
  const { page, pageSize } = c.req.valid('query');

  const { data, pagination } = await paginate(
    db.organizationUser,
    {
      where: { userId: user.id },
      include: { organization: true },
    },
    { page, pageSize },
  );

  return respond.ok(data, { pagination });
});
