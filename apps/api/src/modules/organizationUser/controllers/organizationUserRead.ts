/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { includeTargetEntitlements } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationUserReadRoute } from '#/modules/organizationUser/routes/organizationUserRead';

export const organizationUserReadController = makeController(
  organizationUserReadRoute,
  async (c, respond) => {
    const orgUser = getResource<'organizationUser'>(c);
    const loaded = await c.get('db').organizationUser.findUniqueOrThrow({
      where: { id: orgUser.id },
      include: includeTargetEntitlements,
    });
    return respond.ok(loaded);
  },
);
