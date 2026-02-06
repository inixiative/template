import { SpaceScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const organizationReadManySpacesRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.space,
  many: true,
  paginate: true,
  responseSchema: SpaceScalarSchema,
  middleware: [validatePermission('read')],
  tags: [Tags.space, Tags.organization],
});
