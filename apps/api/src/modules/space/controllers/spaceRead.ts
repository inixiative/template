/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadRoute } from '#/modules/space/routes/spaceRead';

export const spaceReadController = makeController(spaceReadRoute, async (c, respond) => {
  const space = contextResource<'space'>(c);
  return respond.ok(space);
});
