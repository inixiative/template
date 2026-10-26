/**
 * @atlas
 * @kind constructor
 * @partOf primitive:routeTemplates
 * @uses none
 * @constructs route
 */
import { createRoute, type RouteConfig } from '@hono/zod-openapi';
import { securityForRoute } from '#/lib/auth/routeSecurity';
import type { RouteArgs } from '#/lib/routeTemplates/types';
import {
  buildOperationId,
  buildRequest,
  buildResponses,
  buildRoutePath,
  buildTags,
  prepareMiddleware,
} from '#/lib/routeTemplates/utils';

export const actionRoute = <const T extends RouteArgs>(args: T) => {
  const {
    model,
    submodel,
    action,
    description,
    skipId = false,
    middleware = [],
    admin = false,
    internal = false,
    tags,
    ...routeArgs
  } = args;

  if (!action) throw new Error('action is required for action routes');

  const resourceName = submodel || model;
  const routePath = buildRoutePath({ submodel, action, skipId, operation: 'action' });
  const routeTags = buildTags({ model, submodel, tags, admin, internal });

  const route = createRoute({
    ...routeArgs,
    model,
    submodel,
    operationId: buildOperationId({ action, model, submodel, admin, internal }),
    method: 'post',
    path: routePath,
    tags: routeTags,
    security: securityForRoute(args),
    description: description ?? `Performs ${action} on a ${resourceName}.`,
    middleware: prepareMiddleware({
      middleware,
      skipId: skipId,
      includeDeleted: args.includeDeleted,
      route: (): RouteConfig => route,
    }),
    request: buildRequest(args),
    responses: buildResponses(args, 200),
  });
  return route;
};
