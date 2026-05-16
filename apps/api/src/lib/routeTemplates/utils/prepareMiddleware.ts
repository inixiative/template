import type { ModelName } from '@template/db';
import type { MiddlewareHandler } from 'hono';
import { resourceContextMiddleware } from '#/middleware/resources/resourceContextMiddleware';
import { searchableFieldsMiddleware } from '#/middleware/resources/searchableFieldsMiddleware';

export const prepareMiddleware = (
  middleware: MiddlewareHandler | MiddlewareHandler[] | undefined,
  skipId = true,
  searchableFields?: readonly string[],
  model?: ModelName,
): MiddlewareHandler[] | undefined => {
  const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : [];
  const resourceMiddleware = skipId ? [] : [resourceContextMiddleware()];
  // Register the searchable middleware whenever a model OR fields are
  // provided. Model-without-fields covers admin readMany routes — they
  // skip the searchableFields whitelist (superadmin bypass) but still
  // need the model so buildWhereClause can type-check operators and
  // coerce values per field kind.
  const searchMiddleware =
    model || searchableFields?.length ? [searchableFieldsMiddleware({ fields: searchableFields ?? [], model })] : [];
  const result = [...resourceMiddleware, ...searchMiddleware, ...middlewareArray];

  return result.length ? result : undefined;
};
