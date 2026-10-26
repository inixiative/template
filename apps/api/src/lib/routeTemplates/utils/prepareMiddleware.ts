/**
 * @atlas
 * @kind utils
 * @partOf primitive:routeTemplates
 * @uses primitive:requestContext
 */
import type { RouteConfig } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import type { MiddlewareHandler } from 'hono';
import type { RouteArgs } from '#/lib/routeTemplates/types';
import { includeDeletedMiddleware } from '#/middleware/resources/includeDeletedMiddleware';
import { resourceContextMiddleware } from '#/middleware/resources/resourceContextMiddleware';
import { isSubmodelCheck } from '#/middleware/validations/validateSubmodelPermission';

type PrepareMiddlewareArgs = {
  middleware: MiddlewareHandler | MiddlewareHandler[] | undefined;
  skipId?: boolean;
  filterLens?: LensNarrowing;
  includeDeleted?: boolean;
  submodel?: RouteArgs['submodel'];
  route: () => RouteConfig;
};

const filterLensSetter =
  (filterLens: LensNarrowing): MiddlewareHandler =>
  async (c, next) => {
    c.set('filterLens', filterLens);
    await next();
  };

const routeConfigSetter =
  (route: () => RouteConfig): MiddlewareHandler =>
  async (c, next) => {
    c.set('routeConfig', route());
    await next();
  };

export const prepareMiddleware = ({
  middleware,
  skipId = true,
  filterLens,
  includeDeleted = false,
  submodel,
  route,
}: PrepareMiddlewareArgs): MiddlewareHandler[] => {
  const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : [];
  if (!submodel && middlewareArray.some(isSubmodelCheck))
    throw new Error('validateSubmodelPermission needs a route with a submodel');
  const resourceMiddleware = skipId ? [] : [resourceContextMiddleware()];
  const filterMiddleware = filterLens ? [filterLensSetter(filterLens)] : [];
  const deletedMiddleware = includeDeleted ? [includeDeletedMiddleware()] : [];
  return [
    routeConfigSetter(route),
    ...deletedMiddleware,
    ...resourceMiddleware,
    ...filterMiddleware,
    ...middlewareArray,
  ];
};
