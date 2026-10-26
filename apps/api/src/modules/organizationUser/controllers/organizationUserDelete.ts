/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { hydrate, type OrganizationId } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import { check, rebacSchema } from '@template/permissions/rebac';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { validateNotLastOwner } from '#/modules/organization/validations/validateNotLastOwner';
import { organizationUserDeleteRoute } from '#/modules/organizationUser/routes/organizationUserDelete';

export const organizationUserDeleteController = makeController(
  organizationUserDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const orgUser = getResource<'organizationUser'>(c);
    const permix = c.get('permix');

    const hydrated = await hydrate('organizationUser', orgUser);
    const canLeave = check(permix, rebacSchema, 'organizationUser', hydrated, 'leave');
    const canAssign = check(permix, rebacSchema, 'organizationUser', hydrated, 'assign');
    if (!canLeave && !canAssign) throw makeError({ status: 403, message: 'Access denied' });
    if (orgUser.role === Role.owner)
      await validateNotLastOwner(orgUser.organizationId as OrganizationId);

    await db.organizationUser.delete({ where: { id: orgUser.id } });

    return respond.noContent();
  },
);
