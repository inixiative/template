import { Role } from '@template/db/generated/client/enums';
import type { OrganizationId } from '@template/db';
import { greaterRole } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { validateNotLastOwner } from '#/modules/organization/validations/validateNotLastOwner';
import { organizationUserUpdateRoute } from '#/modules/organizationUser/routes/organizationUserUpdate';

export const organizationUserUpdateController = makeController(organizationUserUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const orgUser = getResource<'organizationUser'>(c);
  const body = c.req.valid('json');
  const permix = c.get('permix');

  const role = greaterRole(orgUser.role, body.role);
  if (!check(permix, rebacSchema, 'organization', { id: orgUser.organizationId as OrganizationId, role }, 'assign'))
    throw makeError({ status: 403, message: 'Access denied', requestId: c.get('requestId') });

  if (orgUser.role === Role.owner && body.role !== Role.owner) {
    await validateNotLastOwner(db, orgUser.organizationId as OrganizationId, c.get('requestId'));
  }

  const updated = await db.organizationUser.update({
    where: { id: orgUser.id },
    data: body,
  });

  return respond.ok(updated);
});
