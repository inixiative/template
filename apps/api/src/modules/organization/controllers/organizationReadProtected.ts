/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadProtectedRoute } from '#/modules/organization/routes/organizationReadProtected';

export const organizationReadProtectedController = makeController(
  organizationReadProtectedRoute,
  async (c, respond) => {
    const organization = contextResource<'organization'>(c);
    return respond.ok(organization);
  },
);
