import { createRoute } from '@hono/zod-openapi';
import type { RouteArgs } from '#/lib/routeTemplates/types';
import { buildOperationId, buildRequest, buildResponses, buildTags, prepareMiddleware } from '#/lib/routeTemplates/utils';

export const updateRoute = <const T extends RouteArgs>(args: T) => {
  const {
    model,
    submodel,
    action,
    description,
    skipId = false,
    middleware = [],
    admin = false,
    tags,
    ...routeArgs
  } = args;

  const resourceName = submodel || model;
  const routePath = skipId ? (action ? `/${action}` : '/') : action ? `/:id/${action}` : '/:id';
  const routeTags = buildTags({ model, submodel, tags, admin });

  return createRoute({
    ...routeArgs,
    operationId: buildOperationId({ action: 'update', model, submodel, admin }),
    method: 'patch',
    path: routePath,
    tags: routeTags,
    description: description ?? `Updates an existing ${resourceName}.`,
    middleware: prepareMiddleware(middleware, skipId),
    request: buildRequest(args),
    responses: buildResponses(args, 200),
  });
};
