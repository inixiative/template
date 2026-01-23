import { createRoute, z } from '@hono/zod-openapi';
import { errorResponses } from './errorResponses';
import { idParamsSchema } from './idParamsSchema';
import type { UpdateRouteArgs, ZodResponseSchema, ZodSchema } from './types';

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const buildOperationId = (model: string, submodel?: string) => {
  const parts = ['update', capitalize(model)];
  if (submodel) parts.push(capitalize(submodel));
  return parts.join('');
};

export const updateRoute = <
  TResponse extends ZodResponseSchema | undefined,
  TBody extends ZodSchema,
  TParams extends ZodSchema | undefined = undefined,
  TQuery extends ZodSchema | undefined = undefined,
>(
  args: UpdateRouteArgs<TResponse, TBody, TParams, TQuery>,
) => {
  const {
    model,
    submodel,
    action,
    responseSchema,
    bodySchema,
    description,
    skipId = false,
    params,
    query,
    middleware = [],
    sanitizeKeys = [],
    ...routeArgs
  } = args;

  const paramsSchema = params ?? (skipId ? z.object({}) : idParamsSchema);
  const querySchema = query ?? z.object({});
  const resourceName = submodel || model;

  // Optionally sanitize keys from body schema
  const finalBodySchema = sanitizeKeys.length > 0 ? bodySchema.omit(
    sanitizeKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<string, true>),
  ) : bodySchema;

  const routePath = skipId ? (action ? `/${action}` : '/') : (action ? `/:id/${action}` : '/:id');

  // If no response schema, return 204 No Content
  const responses = responseSchema
    ? {
        200: {
          content: {
            'application/json': {
              schema: z.object({ data: responseSchema }),
            },
          },
          description: `Successfully updated the ${resourceName}.`,
        },
        ...errorResponses,
      }
    : {
        204: {
          description: `Successfully updated the ${resourceName}.`,
        },
        ...errorResponses,
      };

  return createRoute({
    operationId: buildOperationId(model, submodel),
    method: 'patch',
    path: routePath,
    description: description ?? `Updates an existing ${resourceName}.`,
    middleware,
    request: {
      params: paramsSchema,
      query: querySchema,
      body: {
        content: {
          'application/json': {
            schema: finalBodySchema,
          },
        },
        description: `The ${resourceName} fields to update.`,
        required: true,
      },
    },
    responses,
    ...routeArgs,
  });
};
