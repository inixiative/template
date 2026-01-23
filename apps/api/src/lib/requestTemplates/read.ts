import { createRoute, z } from '@hono/zod-openapi';
import { errorResponses } from './errorResponses';
import { idParamsSchema } from './idParamsSchema';
import { paginateRequestSchema, paginateResponseSchema } from './paginationSchemas';
import type { ReadRouteArgs, ZodResponseSchema, ZodSchema } from './types';

const pluralize = (word: string): string => {
  if (word.endsWith('y')) return word.slice(0, -1) + 'ies';
  if (word.endsWith('s')) return word + 'es';
  return word + 's';
};

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const buildOperationId = (action: string, model: string, submodel?: string, many?: boolean) => {
  const parts = [action, capitalize(model)];
  if (submodel) parts.push(capitalize(submodel));
  if (many) parts.push('Many');
  return parts.join('');
};

const buildRoutePath = (submodel?: string, action?: string, skipId?: boolean, many?: boolean) => {
  const parts: string[] = [];
  if (!skipId && !many) parts.push(':id');
  if (submodel) parts.push(pluralize(submodel));
  if (action) parts.push(action);
  return '/' + parts.join('/');
};

export const readRoute = <
  TResponse extends ZodResponseSchema,
  TParams extends ZodSchema | undefined = undefined,
  TQuery extends ZodSchema | undefined = undefined,
>(
  args: ReadRouteArgs<TResponse, TParams, TQuery>,
) => {
  const {
    model,
    submodel,
    action,
    responseSchema,
    description,
    skipId = false,
    params,
    query,
    middleware = [],
    many = false,
    paginate = false,
    ...routeArgs
  } = args;

  const paramsSchema =
    params ?? (skipId ? z.object({}) : submodel ? idParamsSchema : many ? z.object({}) : idParamsSchema);
  const baseQuerySchema = query ?? z.object({});
  const querySchema = many && paginate ? paginateRequestSchema.merge(baseQuerySchema) : baseQuerySchema;

  const resourceName = submodel ? (many ? pluralize(submodel) : submodel) : many ? pluralize(model) : model;
  const parentContext = submodel ? ` for a ${model}` : '';

  const dataSchema = many && responseSchema ? z.array(responseSchema) : responseSchema;
  const finalResponseSchema =
    many && paginate
      ? z.object({ data: dataSchema, pagination: paginateResponseSchema })
      : z.object({ data: dataSchema });

  const routePath = buildRoutePath(submodel, action, skipId, many);

  return createRoute({
    operationId: buildOperationId(action || 'read', model, submodel, many),
    method: 'get',
    path: routePath,
    description:
      description ??
      (many
        ? `Retrieves a list of ${resourceName}${parentContext}.`
        : `Retrieves an existing ${resourceName}${parentContext}.`),
    middleware,
    request: {
      params: paramsSchema as TParams extends undefined
        ? typeof args.skipId extends true
          ? z.ZodObject<{}>
          : typeof idParamsSchema
        : TParams,
      query: querySchema as TQuery extends undefined
        ? typeof paginate extends true
          ? typeof paginateRequestSchema
          : z.ZodObject<{}>
        : TQuery,
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: finalResponseSchema,
          },
        },
        description: many
          ? `Successfully retrieved a list of ${resourceName}.`
          : `Successfully retrieved the ${resourceName}.`,
      },
      ...errorResponses,
    },
    ...routeArgs,
  });
};
