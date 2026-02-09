import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadProtectedRoute } from '#/modules/organization/routes/organizationReadProtected';

export const organizationReadProtectedController = makeController(
  organizationReadProtectedRoute,
  async (c, respond) => {
    const organization = getResource<'organization'>(c);
    return respond.ok(organization);
  },
);
