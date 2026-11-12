/**
 * @atlas
 * @kind constructor
 * @partOf primitive:routeTemplates
 * @uses none
 * @constructs route
 */
import { createRoute, type RouteConfig, z } from '@hono/zod-openapi';
import { securityForRoute } from '#/lib/auth/routeSecurity';
import { errorResponses } from '#/lib/routeTemplates/errorResponses';
import type { RouteArgs } from '#/lib/routeTemplates/types';
import {
  buildOperationId,
  buildRequest,
  buildRoutePath,
  buildTags,
  prepareMiddleware,
} from '#/lib/routeTemplates/utils';

/** The ids a delete-many removes, as the request body. */
const deleteManyBodySchema = z.array(z.string().min(1)).min(1);

const deleteManyBody = {
  content: { 'application/json': { schema: deleteManyBodySchema } },
  required: true,
} as const;

export const deleteRoute = <const T extends RouteArgs>(args: T) => {
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
  const routePath = many
    ? buildRoutePath({ submodel, action, skipId, many, operation: 'delete' })
    : skipId
      ? action
        ? `/${action}`
        : '/'
      : action
        ? `/{id}/${action}`
        : '/{id}';
  const routeTags = buildTags({ model, submodel, tags, admin, internal });
  const request = buildRequest(args);

  const route = createRoute({
    ...routeArgs,
    model,
    submodel,
    operationId: buildOperationId({
      action: action ?? 'delete',
      model,
      submodel,
      many,
      admin,
      internal,
    }),
    method: 'delete',
    path: routePath,
    tags: routeTags,
    security: securityForRoute(args),
    description:
      description ??
      (many ? `Deletes ${resourceName} rows by id.` : `Deletes an existing ${resourceName}.`),
    middleware: prepareMiddleware(args, { skipId: skipId, route: (): RouteConfig => route }),
    request: (many ? { ...request, body: deleteManyBody } : request) as T['many'] extends true
      ? typeof request & { body: typeof deleteManyBody }
      : typeof request,
    responses: {
      204: { description: 'Success' },
      ...errorResponses,
    },
  });
  return route;
};
