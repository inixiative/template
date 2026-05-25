import type { LensNarrowing } from '@inixiative/json-rules';
import type { MiddlewareHandler } from 'hono';
import { resourceContextMiddleware } from '#/middleware/resources/resourceContextMiddleware';
import { searchableFieldsMiddleware } from '#/middleware/resources/searchableFieldsMiddleware';

export const prepareMiddleware = (
  middleware: MiddlewareHandler | MiddlewareHandler[] | undefined,
  skipId = true,
  narrowing?: LensNarrowing,
): MiddlewareHandler[] | undefined => {
  const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : [];
  const resourceMiddleware = skipId ? [] : [resourceContextMiddleware()];
  const searchMiddleware = narrowing ? [searchableFieldsMiddleware({ narrowing })] : [];
  const result = [...resourceMiddleware, ...searchMiddleware, ...middlewareArray];

  return result.length ? result : undefined;
};
