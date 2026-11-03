/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { includeTargetEntitlements, withEntitlementEntries } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserReadRoute } from '#/modules/spaceUser/routes/spaceUserRead';

export const spaceUserReadController = makeController(spaceUserReadRoute, async (c, respond) => {
  const spaceUser = getResource<'spaceUser'>(c);
  const loaded = await c.get('db').spaceUser.findUniqueOrThrow({
    where: { id: spaceUser.id },
    include: includeTargetEntitlements,
  });
  return respond.ok(withEntitlementEntries(loaded));
});
