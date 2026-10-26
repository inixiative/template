/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import type { OrganizationId } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { validateNotLastOwner } from '#/modules/organization/validations/validateNotLastOwner';
import { organizationUserDeleteRoute } from '#/modules/organizationUser/routes/organizationUserDelete';

export const organizationUserDeleteController = makeController(
  organizationUserDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const orgUser = getResource<'organizationUser'>(c);

    if (orgUser.role === Role.owner)
      await validateNotLastOwner(orgUser.organizationId as OrganizationId);

    await db.organizationUser.delete({ where: { id: orgUser.id } });

    return respond.noContent();
  },
);
