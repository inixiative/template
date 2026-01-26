import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadRoute } from '#/modules/organization/routes/organizationRead';

export const organizationReadController = makeController(organizationReadRoute, async (c, respond) => {
  const organization = getResource<'organization'>(c);
  return respond.ok(organization);
});
