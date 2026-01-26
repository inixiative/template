import { readRoute } from '#/lib/requestTemplates';
import { validateOrgPermission } from '#/middleware/validations/validateOrgPermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import { tokenReadResponseSchema } from '#/modules/token/schemas/tokenSchemas';

export const organizationReadManyTokenRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.token,
  many: true,
  paginate: true,
  responseSchema: tokenReadResponseSchema,
  tags: [Tags.Token],
  middleware: [validateOrgPermission('read')],
});
