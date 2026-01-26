import { getResource } from '#/lib/context/getResource';
import { canAssignRole } from '#/lib/permissions/canAssignRole';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateUserRoute } from '#/modules/organization/routes/organizationCreateUser';

export const organizationCreateUserController = makeController(organizationCreateUserRoute, async (c, respond) => {
  const db = c.get('db');
  const org = getResource<'organization'>(c);
  const body = c.req.valid('json');

  canAssignRole(c.get('permix'), org.id, body.role);

  const orgUser = await db.organizationUser.create({
    data: {
      organizationId: org.id,
      userId: body.userId,
      role: body.role,
    },
  });

  return respond.created(orgUser);
});
