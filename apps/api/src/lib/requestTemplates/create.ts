import { createRoute, z } from '@hono/zod-openapi';
import { errorResponses } from './errorResponses';
import type { CreateRouteArgs, ZodResponseSchema, ZodSchema } from './types';

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const buildOperationId = (model: string, submodel?: string) => {
  const parts = ['create', capitalize(model)];
  if (submodel) parts.push(capitalize(submodel));
  return parts.join('');
};

export const createRouteTemplate = <
  TResponse extends ZodResponseSchema | undefined,
  TBody extends ZodSchema,
  TParams extends ZodSchema | undefined = undefined,
  TQuery extends ZodSchema | undefined = undefined,
>(
  args: CreateRouteArgs<TResponse, TBody, TParams, TQuery>,
) => {
  const {
    model,
    submodel,
    action,
    responseSchema,
    bodySchema,
    description,
    params,
    query,
    middleware = [],
    sanitizeKeys = [],
    ...routeArgs
  } = args;

  const paramsSchema = params ?? z.object({});
  const querySchema = query ?? z.object({});
  const resourceName = submodel || model;

  // Optionally sanitize keys from body schema
  const finalBodySchema = sanitizeKeys.length > 0 ? bodySchema.omit(
    sanitizeKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<string, true>),
  ) : bodySchema;

  const routePath = action ? `/${action}` : '/';

  // If no response schema, return 204 No Content
  const responses = responseSchema
    ? {
        201: {
          content: {
            'application/json': {
              schema: z.object({ data: responseSchema }),
            },
          },
          description: `Successfully created the ${resourceName}.`,
        },
        ...errorResponses,
      }
    : {
        204: {
          description: `Successfully created the ${resourceName}.`,
        },
        ...errorResponses,
      };

  return createRoute({
    operationId: buildOperationId(model, submodel),
    method: 'post',
    path: routePath,
    description: description ?? `Creates a new ${resourceName}.`,
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
        description: `The ${resourceName} to create.`,
        required: true,
      },
    },
    responses,
    ...routeArgs,
  });
};
