import { createRoute } from '@hono/zod-openapi';
import { errorResponses } from '#/lib/routeTemplates/errorResponses';
import type { RouteArgs } from '#/lib/routeTemplates/types';
import { buildOperationId, buildRequest, buildTags, prepareMiddleware } from '#/lib/routeTemplates/utils';

export const deleteRoute = <const T extends RouteArgs>(args: T) => {
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
    operationId: buildOperationId({ action: 'delete', model, submodel, admin }),
    method: 'delete',
    path: routePath,
    tags: routeTags,
    description: description ?? `Deletes an existing ${resourceName}.`,
    middleware: prepareMiddleware(middleware, skipId),
    request: buildRequest(args),
    responses: {
      204: { description: 'Success' },
      ...errorResponses,
    },
  });
};
