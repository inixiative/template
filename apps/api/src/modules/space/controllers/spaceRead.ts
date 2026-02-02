import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadRoute } from '#/modules/space/routes/spaceRead';

export const spaceReadController = makeController(spaceReadRoute, async (c, respond) => {
  const space = getResource<'space'>(c);
  return respond.ok(space);
});
