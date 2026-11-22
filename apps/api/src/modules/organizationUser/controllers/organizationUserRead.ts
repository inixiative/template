/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { includeTargetEntitlements } from '@template/db';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationUserReadRoute } from '#/modules/organizationUser/routes/organizationUserRead';

export const organizationUserReadController = makeController(
  organizationUserReadRoute,
  async (c, respond) => {
    const orgUser = contextResource<'organizationUser'>(c);
    const loaded = await c.get('db').organizationUser.findUniqueOrThrow({
      where: { id: orgUser.id },
      include: includeTargetEntitlements('OrganizationUser'),
    });
    return respond.ok(loaded);
  },
);
