import { ContactScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const adminContactReadManyRoute = readRoute({
  model: Modules.contact,
  many: true,
  paginate: true,
  skipId: true,
  admin: true,
  narrowing: { parent: lensFor('Contact') },
  responseSchema: ContactScalarSchema,
});
