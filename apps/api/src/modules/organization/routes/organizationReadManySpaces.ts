/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 */
import { SpaceScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const organizationReadManySpacesRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.space,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('Space') },
  responseSchema: SpaceScalarSchema,
  middleware: [validatePermission('read')],
  tags: [Tags.space, Tags.organization],
});
