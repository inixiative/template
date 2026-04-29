import type { AccessorName } from '@template/db';
import type { MiddlewareHandler } from 'hono';
import { resourceContextMiddleware } from '#/middleware/resources/resourceContextMiddleware';
import { searchableFieldsMiddleware } from '#/middleware/resources/searchableFieldsMiddleware';

export const prepareMiddleware = (
  middleware: MiddlewareHandler | MiddlewareHandler[] | undefined,
  skipId = true,
  searchableFields?: readonly string[],
  model?: AccessorName,
): MiddlewareHandler[] | undefined => {
  const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : [];
  const resourceMiddleware = skipId ? [] : [resourceContextMiddleware()];
  const searchMiddleware = searchableFields?.length
    ? [searchableFieldsMiddleware({ fields: searchableFields, model })]
    : [];
  const result = [...resourceMiddleware, ...searchMiddleware, ...middlewareArray];

  return result.length ? result : undefined;
};
