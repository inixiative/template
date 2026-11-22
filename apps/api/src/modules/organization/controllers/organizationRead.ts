/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadRoute } from '#/modules/organization/routes/organizationRead';

export const organizationReadController = makeController(
  organizationReadRoute,
  async (c, respond) => {
    const organization = contextResource<'organization'>(c);
    return respond.ok(organization);
  },
);
