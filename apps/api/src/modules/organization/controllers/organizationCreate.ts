import { makeController } from '#/lib/utils/makeController';
import { organizationCreateRoute } from '#/modules/organization/routes/organizationCreate';

export const organizationCreateController = makeController(organizationCreateRoute, async (c, respond) => {
  const db = c.get('db');
  const user = c.get('user')!;
  const body = c.req.valid('json');

  const organization = await db.organization.create({
    data: {
      ...body,
      organizationUsers: {
        create: {
          userId: user!.id,
          role: 'owner',
        },
      },
    },
    include: {
      organizationUsers: true
    },
  });

  const organizationUser = organization.organizationUsers[0];
  const { organizationUsers: _organizationUsers, ...organizationData } = organization;

  return respond.created({
    ...organizationData,
    organizationUser,
  });
});
