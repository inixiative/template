import { createRoute as honoCreateRoute } from '@hono/zod-openapi';
import type { RouteArgs } from '#/lib/requestTemplates/types';
import { buildOperationId, buildRequest, buildResponses, buildRoutePath, buildTags, prepareMiddleware } from '#/lib/requestTemplates/utils';

export const createRoute = <const T extends RouteArgs>(args: T) => {
  const { model, submodel, action, description, skipId, many, middleware = [], admin, tags, ...routeArgs } = args;

  const resourceName = submodel || model;
  const routePath = buildRoutePath({ submodel, action, skipId, many, operation: 'create' });
  const routeTags = buildTags({ model, submodel, tags, admin });
  const skipResource = !submodel;
  const skipIdForRequest = skipId || !submodel;

  return honoCreateRoute({
    ...routeArgs,
    operationId: buildOperationId({ action: 'create', model, submodel, admin }),
    method: 'post',
    path: routePath,
    tags: routeTags,
    description: description ?? `Creates a new ${resourceName}.`,
    middleware: prepareMiddleware(middleware, skipResource),
    request: buildRequest({ ...args, skipId: skipIdForRequest }),
    responses: buildResponses(args, 201),
  });
};
