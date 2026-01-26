import { createRoute } from '@hono/zod-openapi';
import pluralize from 'pluralize';
import type { RouteArgs } from '#/lib/requestTemplates/types';
import { buildOperationId, buildRequest, buildResponses, buildRoutePath, prepareMiddleware } from '#/lib/requestTemplates/utils';

export const readRoute = <const T extends RouteArgs>(args: T) => {
  const {
    model,
    submodel,
    action,
    responseSchema,
    description,
    skipId = false,
    middleware = [],
    many = false,
    admin = false,
    tags = [],
  } = args;

  if (!responseSchema) throw new Error('responseSchema is required for read routes');

  const resourceName = submodel ? (many ? pluralize(submodel) : submodel) : many ? pluralize(model) : model;
  const parentContext = submodel ? ` for a ${model}` : '';
  const routePath = buildRoutePath({ submodel, action, skipId, many });
  const routeTags = admin ? ['Admin', ...tags] : tags;
  const skipResource = skipId || (many && !submodel);

  return createRoute({
    ...args,
    operationId: buildOperationId({ action: action || 'read', model, submodel, many, admin }),
    method: 'get',
    path: routePath,
    tags: routeTags,
    description:
      description ??
      (many
        ? `Retrieves a list of ${resourceName}${parentContext}.`
        : `Retrieves an existing ${resourceName}${parentContext}.`),
    middleware: prepareMiddleware(middleware, skipResource),
    request: buildRequest(args),
    responses: buildResponses(args, 200),
  });
};
