import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadProtectedRoute } from '#/modules/space/routes/spaceReadProtected';

export const spaceReadProtectedController = makeController(spaceReadProtectedRoute, async (c, respond) => {
  const space = getResource<'space'>(c);
  // TODO: Expand with additional protected data as needed
  return respond.ok(space);
});
