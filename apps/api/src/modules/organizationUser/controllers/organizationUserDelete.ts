import { organizationId, OrganizationRole } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { getUser } from '#/lib/context/getUser';
import { canAssignRole } from '#/lib/permissions/canAssignRole';
import { makeController } from '#/lib/utils/makeController';
import { checkNotLastOwner } from '#/modules/organization/services/isLastOwner';
import { organizationUserDeleteRoute } from '#/modules/organizationUser/routes/organizationUserDelete';

export const organizationUserDeleteController = makeController(organizationUserDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const orgUser = getResource<'organizationUser'>(c);
  const orgId = organizationId(orgUser.organizationId);

  if (getUser(c)?.id !== orgUser.userId) canAssignRole(c.get('permix'), orgId, orgUser.role);
  if (orgUser.role === OrganizationRole.owner) await checkNotLastOwner(db, orgId);

  await db.organizationUser.delete({ where: { id: orgUser.id } });

  return respond.noContent();
});
