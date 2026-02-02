import { OrganizationScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const organizationReadRoute = readRoute({
  model: Modules.organization,
  responseSchema: OrganizationScalarSchema,
});
