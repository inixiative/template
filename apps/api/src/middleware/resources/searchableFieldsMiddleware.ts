import type { ModelName } from '@template/db';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';

type Args = { fields: readonly string[]; model?: ModelName };

// Stash the searchable fields + the search-target model in context so paginate
// can hand them to buildWhereClause for prismaMap-driven enum-aware filtering.
// searchableModel is intentionally distinct from resourceType (the permission
// owner) — for submodel list routes like /organization/:id/inquiry,
// resourceType=Organization but searchableModel=Inquiry. They only collapse
// for non-submodel routes.
export const searchableFieldsMiddleware = makeMiddleware<Args>(({ fields, model }) => async (c, next) => {
  c.set('searchableFields', fields);
  c.set('searchableModel', model ?? null);
  await next();
});
