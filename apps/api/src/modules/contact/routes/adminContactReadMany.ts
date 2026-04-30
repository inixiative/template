import { ContactScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const adminContactReadManyRoute = readRoute({
  model: Modules.contact,
  many: true,
  paginate: true,
  skipId: true,
  admin: true,
  responseSchema: ContactScalarSchema,
});
