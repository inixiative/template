import type { AccessorName } from '@template/db';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';

type Args = { fields: readonly string[]; model?: AccessorName };

// Stash searchable fields + the route's accessor (resourceType) so paginate
// can hand them to buildWhereClause. resourceType is unified with what
// resourceContextMiddleware sets — same key, same shape — so paginate has
// one source of truth regardless of whether the route has an :id.
export const searchableFieldsMiddleware = makeMiddleware<Args>(({ fields, model }) => async (c, next) => {
  c.set('searchableFields', fields);
  if (model) c.set('resourceType', model);
  await next();
});
