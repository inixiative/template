import { createRoute } from '@hono/zod-openapi';
import type { RouteArgs } from '#/lib/requestTemplates/types';
import { buildOperationId, buildRequest, buildResponses, buildTags, prepareMiddleware } from '#/lib/requestTemplates/utils';

export const actionRoute = <const T extends RouteArgs>(args: T) => {
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

  if (!action) throw new Error('action is required for action routes');

  const resourceName = submodel || model;
  const routePath = skipId ? `/${action}` : `/:id/${action}`;
  const routeTags = buildTags({ model, submodel, tags, admin });

  return createRoute({
    ...routeArgs,
    operationId: buildOperationId({ action, model, submodel, admin }),
    method: 'post',
    path: routePath,
    tags: routeTags,
    description: description ?? `Performs ${action} on a ${resourceName}.`,
    middleware: prepareMiddleware(middleware, skipId),
    request: buildRequest(args),
    responses: buildResponses(args, 200),
  });
};
