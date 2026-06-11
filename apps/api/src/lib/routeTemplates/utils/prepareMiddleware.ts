/**
 * @atlas
 * @kind utils
 * @partOf primitive:routeTemplates
 */
import type { LensNarrowing } from '@inixiative/json-rules';
import type { MiddlewareHandler } from 'hono';
import { resourceContextMiddleware } from '#/middleware/resources/resourceContextMiddleware';

const filterLensSetter =
  (filterLens: LensNarrowing): MiddlewareHandler =>
  async (c, next) => {
    c.set('filterLens', filterLens);
    await next();
  };

export const prepareMiddleware = (
  middleware: MiddlewareHandler | MiddlewareHandler[] | undefined,
  skipId = true,
  filterLens?: LensNarrowing,
): MiddlewareHandler[] | undefined => {
  const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : [];
  const resourceMiddleware = skipId ? [] : [resourceContextMiddleware()];
  const filterMiddleware = filterLens ? [filterLensSetter(filterLens)] : [];
  const result = [...resourceMiddleware, ...filterMiddleware, ...middlewareArray];
  return result.length ? result : undefined;
};
