import { createRoute, z } from '@hono/zod-openapi';
import { errorResponses } from './errorResponses';
import { idParamsSchema } from './idParamsSchema';
import type { DeleteRouteArgs, ZodResponseSchema, ZodSchema } from './types';

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const buildOperationId = (model: string, submodel?: string) => {
  const parts = ['delete', capitalize(model)];
  if (submodel) parts.push(capitalize(submodel));
  return parts.join('');
};

export const deleteRoute = <
  TResponse extends ZodResponseSchema,
  TParams extends ZodSchema | undefined = undefined,
  TQuery extends ZodSchema | undefined = undefined,
>(
  args: DeleteRouteArgs<TResponse, TParams, TQuery>,
) => {
  const {
    model,
    submodel,
    action,
    description,
    skipId = false,
    params,
    query,
    middleware = [],
    ...routeArgs
  } = args;

  const paramsSchema = params ?? (skipId ? z.object({}) : idParamsSchema);
  const querySchema = query ?? z.object({});
  const resourceName = submodel || model;

  const routePath = skipId ? (action ? `/${action}` : '/') : (action ? `/:id/${action}` : '/:id');

  return createRoute({
    operationId: buildOperationId(model, submodel),
    method: 'delete',
    path: routePath,
    description: description ?? `Deletes an existing ${resourceName}.`,
    middleware,
    request: {
      params: paramsSchema,
      query: querySchema,
    },
    responses: {
      204: {
        description: `Successfully deleted the ${resourceName}.`,
      },
      ...errorResponses,
    },
    ...routeArgs,
  });
};
