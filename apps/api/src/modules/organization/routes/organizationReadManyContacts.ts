import { ContactScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const organizationReadManyContactsRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.contact,
  many: true,
  paginate: true,
  middleware: [validatePermission('read')],
  searchableFields: ['type', 'subtype', 'label', 'valueKey'],
  responseSchema: ContactScalarSchema,
});
