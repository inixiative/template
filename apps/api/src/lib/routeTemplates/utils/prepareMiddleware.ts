import type { MiddlewareHandler } from 'hono';
import { resourceContextMiddleware } from '#/middleware/resources/resourceContextMiddleware';
import { searchableFieldsMiddleware } from '#/middleware/resources/searchableFieldsMiddleware';

type PrepareMiddlewareOptions = {
  searchableFields?: readonly string[];
  adminSearchableFields?: readonly string[];
};

export const prepareMiddleware = (
  middleware: MiddlewareHandler | MiddlewareHandler[] | undefined,
  skipId = true,
  searchableFieldsOrOptions?: readonly string[] | PrepareMiddlewareOptions,
): MiddlewareHandler[] | undefined => {
  const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : [];
  const resourceMiddleware = skipId ? [] : [resourceContextMiddleware()];

  const options: PrepareMiddlewareOptions = Array.isArray(searchableFieldsOrOptions)
    ? { searchableFields: searchableFieldsOrOptions as readonly string[] }
    : (searchableFieldsOrOptions as PrepareMiddlewareOptions) ?? {};

  const searchMiddleware = options.searchableFields?.length
    ? [searchableFieldsMiddleware({ searchableFields: options.searchableFields, adminSearchableFields: options.adminSearchableFields })]
    : [];
  const result = [...resourceMiddleware, ...searchMiddleware, ...middlewareArray];

  return result.length ? result : undefined;
};
