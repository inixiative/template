import { organizationId } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { canAssignRole } from '#/lib/permissions/canAssignRole';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateOrganizationUserRoute } from '#/modules/organization/routes/organizationCreateOrganizationUser';
import { validateOrganizationCreateOrganizationUserBody } from '#/modules/organization/validations/organizationCreateOrganizationUserBody';
import { findUserOrCreateGuest } from '#/modules/user/services/findOrCreateGuest';

export const organizationCreateOrganizationUserController = makeController(organizationCreateOrganizationUserRoute, async (c, respond) => {
  const db = c.get('db');
  const org = getResource<'organization'>(c);
  const body = c.req.valid('json');

  validateOrganizationCreateOrganizationUserBody(body);
  canAssignRole(c.get('permix'), organizationId(org.id), body.role);

  const userId = body.userId ?? (await findUserOrCreateGuest(db, { email: body.email!, name: body.name })).id;

  const orgUser = await db.organizationUser.create({
    data: {
      organizationId: org.id,
      userId,
      role: body.role,
    },
    include: { user: true },
  });

  return respond.created(orgUser);
});
