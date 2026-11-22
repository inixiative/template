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
  hasIdParam,
  prepareMiddleware,
} from '#/lib/routeTemplates/utils';

export const updateRoute = <const T extends RouteArgs>(args: T) => {
  const {
    model,
    submodel,
    action,
    description,
    skipId = false,
    many = false,
    middleware = [],
    admin = false,
    internal = false,
    tags,
    ...routeArgs
  } = args;

  const resourceName = submodel || model;
  const routePath = buildRoutePath({ submodel, action, skipId, many, operation: 'update' });
  const routeTags = buildTags({ model, submodel, tags, admin, internal });
  const skipResource = !hasIdParam(skipId, submodel, many);

  const route = createRoute({
    ...routeArgs,
    model,
    submodel,
    operationId: buildOperationId({
      action: action ?? 'update',
      model,
      submodel,
      many,
      admin,
      internal,
    }),
    method: 'patch',
    path: routePath,
    tags: routeTags,
    security: securityForRoute(args),
    description:
      description ??
      (many ? `Updates ${resourceName} rows.` : `Updates an existing ${resourceName}.`),
    middleware: prepareMiddleware(args, { skipId: skipResource, route: (): RouteConfig => route }),
    request: buildRequest(args),
    responses: buildResponses(args, 200),
  });
  return route;
};
