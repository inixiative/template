import { ContactScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meReadManyContactsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.contact,
  many: true,
  paginate: true,
  skipId: true,
  searchableFields: ['type', 'subtype', 'label', 'valueKey'],
  responseSchema: ContactScalarSchema,
  tags: [Tags.me, Tags.contact],
});
