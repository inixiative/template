import { OrganizationRole } from '@template/db';
import { greaterRole } from '@template/permissions';
import { getResource } from '#/lib/context/getResource';
import { canAssignRole } from '#/lib/permissions/canAssignRole';
import { makeController } from '#/lib/utils/makeController';
import { checkNotLastOwner } from '#/modules/organization/services/isLastOwner';
import { organizationUserUpdateRoute } from '#/modules/organizationUser/routes/organizationUserUpdate';

export const organizationUserUpdateController = makeController(organizationUserUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const orgUser = getResource<'organizationUser'>(c);
  const body = c.req.valid('json');

  const targetRole = greaterRole(orgUser.role, body.role);
  canAssignRole(c.get('permix'), orgUser.organizationId, targetRole);

  if (orgUser.role === OrganizationRole.owner && body.role !== OrganizationRole.owner) {
    await checkNotLastOwner(db, orgUser.organizationId);
  }

  const updated = await db.organizationUser.update({
    where: { id: orgUser.id },
    data: body,
  });

  return respond.ok(updated);
});
