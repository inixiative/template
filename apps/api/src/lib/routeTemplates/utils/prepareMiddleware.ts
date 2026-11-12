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
import { meResourceMiddleware } from '#/middleware/resources/meResourceMiddleware';
import { resourceContextMiddleware } from '#/middleware/resources/resourceContextMiddleware';
import { Modules } from '#/modules/modules';

type RouteMiddlewareSetup = {
  skipId: boolean;
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

export const prepareMiddleware = (
  { model, middleware, filterLens, includeDeleted = false }: RouteArgs,
  { skipId, route }: RouteMiddlewareSetup,
): MiddlewareHandler[] => {
  const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : [];
  const resourceMiddleware = skipId ? [] : [resourceContextMiddleware()];
  const filterMiddleware = filterLens ? [filterLensSetter(filterLens)] : [];
  const deletedMiddleware = includeDeleted ? [includeDeletedMiddleware()] : [];
  return [
    ...(model === Modules.me ? [meResourceMiddleware] : []),
    routeConfigSetter(route),
    ...deletedMiddleware,
    ...resourceMiddleware,
    ...filterMiddleware,
    ...middlewareArray,
  ];
};
