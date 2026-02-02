import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserReadRoute } from '#/modules/spaceUser/routes/spaceUserRead';

export const spaceUserReadController = makeController(spaceUserReadRoute, async (c, respond) => {
  const spaceUser = getResource<'spaceUser'>(c);
  return respond.ok(spaceUser);
});
