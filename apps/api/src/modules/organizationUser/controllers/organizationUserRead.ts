import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationUserReadRoute } from '#/modules/organizationUser/routes/organizationUserRead';

export const organizationUserReadController = makeController(organizationUserReadRoute, async (c, respond) => {
  const orgUser = getResource<'organizationUser'>(c);
  return respond.ok(orgUser);
});
