import { makeController } from '#/lib/utils/makeController';
import { organizationCreateRoute } from '#/modules/organization/routes/organizationCreate';

export const organizationCreateController = makeController(organizationCreateRoute, async (c, respond) => {
  const db = c.get('db');
  const user = c.get('user')!;
  const body = c.req.valid('json');

  const { organization, organizationUser } = await db.txn(async () => {
    const organization = await db.organization.create({ data: body });
    const organizationUser = await db.organizationUser.create({
      data: { organizationId: organization.id, userId: user!.id, role: 'owner' },
    });
    return { organization, organizationUser };
  });

  return respond.created({
    ...organization,
    organizationUser,
  });
});
