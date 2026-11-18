/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadProtectedRoute } from '#/modules/space/routes/spaceReadProtected';

export const spaceReadProtectedController = makeController(
  spaceReadProtectedRoute,
  async (c, respond) => {
    const space = contextResource<'space'>(c);
    // TODO: Expand with additional protected data as needed
    return respond.ok(space);
  },
);
