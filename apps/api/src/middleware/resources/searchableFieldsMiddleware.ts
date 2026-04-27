import type { ModelName } from '@template/db';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';

type Args = { fields: readonly string[]; model?: ModelName };

// Stash the model + searchable fields in context so paginate can hand them
// to buildWhereClause, which derives enum-ness from prismaMap. Routes only
// declare searchableFields — enum awareness is the implementation's job.
export const searchableFieldsMiddleware = makeMiddleware<Args>(({ fields, model }) => async (c, next) => {
  c.set('searchableFields', fields);
  c.set('searchableModel', model ?? null);
  await next();
});
