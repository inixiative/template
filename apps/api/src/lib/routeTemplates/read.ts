import { createRoute } from '@hono/zod-openapi';
import { toModelName } from '@template/db';
import pluralize from 'pluralize';
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
    tags,
    searchableFields,
  } = args;

  if (!responseSchema) throw new Error('responseSchema is required for read routes');

  const resourceName = submodel ? (many ? pluralize(submodel) : submodel) : many ? pluralize(model) : model;
  const parentContext = submodel ? ` for a ${model}` : '';
  const routePath = buildRoutePath({ submodel, action, skipId, many });
  const routeTags = buildTags({ model, submodel, tags, admin });
  const skipResource = !hasIdParam(skipId, submodel, many);

  const route = createRoute({
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
    // searchableModel must be the LISTED resource (the submodel on
    // /:id/<submodel> routes, the model otherwise). Using the route's owner
    // model breaks enum-aware filtering on submodel lists like
    // /organization/:id/inquiry, where searchable fields belong to Inquiry,
    // not Organization. Non-Prisma modules (cache, job, me, …) resolve to
    // undefined via toModelName.
    middleware: prepareMiddleware(middleware, skipResource, searchableFields, toModelName(submodel ?? model) ?? undefined),
    request: buildRequest(args),
    responses: buildResponses(args, 200),
  });

  // Add OpenAPI extensions for frontend metadata
  if (searchableFields?.length) {
    // biome-ignore lint/suspicious/noExplicitAny: non-standard OpenAPI extension field not typed by @hono/zod-openapi
    (route as any)['x-searchable-fields'] = searchableFields;
  }

  return route;
};
