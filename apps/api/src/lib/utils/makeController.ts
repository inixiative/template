/**
 * @atlas
 * @kind constructor, utils
 * @partOf primitive:routeTemplates
 * @uses none
 * @constructs controller
 */
import type { RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { Env, TypedResponse } from 'hono';
import { ZodError, type ZodType, z } from 'zod';
import type { ResponseMetadata } from '#/lib/routeTemplates/responseMetadata';
import type { RouteArgs } from '#/lib/routeTemplates/types';
import { isAuthProbe } from '#/lib/utils/authProbe';
import type { AppEnv } from '#/types/appEnv';

type EmptyRecord = Record<never, never>;
type StatusCodesFromRoute<TRoute extends RouteConfig> = TRoute extends { responses: infer R }
  ? keyof R & number
  : never;

type ResponseSchemaFor<TRoute extends RouteConfig, S extends number> = TRoute extends {
  responses: Record<S, { content: { 'application/json': { schema: infer Schema } } }>;
}
  ? Schema
  : never;

type ResponseDataFor<TRoute extends RouteConfig, S extends number> =
  ResponseSchemaFor<TRoute, S> extends z.ZodObject<{ data: infer D extends ZodType }>
    ? z.input<D>
    : unknown;

type PaginationMetadataFor<TRoute extends RouteConfig> =
  ResponseSchemaFor<TRoute, 200> extends z.ZodObject<{ pagination: infer P extends ZodType }>
    ? { pagination: z.input<P> }
    : never;

type OkResponder<TRoute extends RouteConfig, T> = [PaginationMetadataFor<TRoute>] extends [never]
  ? { ok: (data: T) => TypedResponse }
  : { ok: (data: T, metadata: PaginationMetadataFor<TRoute>) => TypedResponse };

type TypedResponders<
  TRoute extends RouteConfig,
  T200,
  T201,
> = (200 extends StatusCodesFromRoute<TRoute> ? OkResponder<TRoute, T200> : EmptyRecord) &
  (201 extends StatusCodesFromRoute<TRoute>
    ? { created: (data: T201, location?: string) => TypedResponse }
    : EmptyRecord) &
  (204 extends StatusCodesFromRoute<TRoute> ? { noContent: () => TypedResponse } : EmptyRecord);

type ResponderBag = {
  ok?: (data: unknown, metadata?: ResponseMetadata) => TypedResponse;
  created?: (data: unknown, location?: string) => TypedResponse;
  noContent?: () => TypedResponse;
};

type JsonResponseSchema = {
  shape: {
    data: ZodType<unknown>;
    pagination?: ZodType<unknown>;
  };
};

type JsonResponseDefinition = {
  content: {
    'application/json': {
      schema: JsonResponseSchema;
    };
  };
};

type JsonResponseBody = {
  data: unknown;
  pagination?: unknown;
};

type RefinableRoute = Pick<RouteArgs, 'bodyRefinement' | 'queryRefinement' | 'paramsRefinement'>;

type ValidatedRequest = { valid: (target: 'json' | 'query' | 'param') => unknown };

// Extract the context type from RouteHandler
type RouteContext<R extends RouteConfig, E extends Env> = Parameters<RouteHandler<R, E>>[0];

export const makeController = <
  R extends RouteConfig,
  T200 = ResponseDataFor<R, 200>,
  T201 = ResponseDataFor<R, 201>,
>(
  route: R,
  handler: (
    c: RouteContext<R, AppEnv>,
    respond: TypedResponders<R, T200, T201>,
  ) => TypedResponse | Promise<TypedResponse>,
): RouteHandler<R, AppEnv> => {
  const { bodyRefinement, queryRefinement, paramsRefinement } = route as RefinableRoute;
  if (bodyRefinement && !route.request?.body)
    throw new Error('bodyRefinement requires a JSON body schema');
  const requestRefinements = (
    [
      ['json', bodyRefinement],
      ['query', queryRefinement],
      ['param', paramsRefinement],
    ] as const
  ).flatMap(([target, refinement]) =>
    refinement ? [{ target, schema: z.unknown().superRefine(refinement) }] : [],
  );

  const impl = async (c: RouteContext<R, AppEnv>) => {
    // WS subscribe probe: reaching the controller means every auth middleware passed —
    // answer without running the handler.
    if (isAuthProbe(c)) return c.body(null, 204) as unknown as TypedResponse;

    for (const { target, schema } of requestRefinements) {
      if (target === 'json' && !c.req.header('content-type')) continue;
      const value = (c.req as ValidatedRequest).valid(target);
      const result = await (Array.isArray(value) ? z.array(schema) : schema).safeParseAsync(value);
      if (!result.success) throw result.error;
    }

    const statusCodes = Object.keys(route.responses || {}).map(Number);
    const responders: ResponderBag = {};

    if (statusCodes.includes(200) && route.responses?.[200]) {
      const response = route.responses[200] as unknown as JsonResponseDefinition;
      const responseSchema = response.content['application/json'].schema;
      if (!responseSchema) throw new Error('Route declares 200 response but missing schema');
      responders.ok = (data: unknown, metadata?: ResponseMetadata) => {
        const validatedData = parseResponseOrThrow500(responseSchema.shape.data, data);
        const responseObj: JsonResponseBody = { data: validatedData };

        if (responseSchema.shape.pagination) {
          responseObj.pagination = parseResponseOrThrow500(
            responseSchema.shape.pagination,
            metadata?.pagination,
          );
        } else if (metadata?.pagination !== undefined) {
          throw new Error('Route does not declare pagination metadata');
        }

        return c.json(responseObj, 200);
      };
    }

    if (statusCodes.includes(201) && route.responses?.[201]) {
      const response = route.responses[201] as unknown as JsonResponseDefinition;
      const responseSchema = response.content['application/json'].schema;
      if (!responseSchema) throw new Error('Route declares 201 response but missing schema');
      responders.created = (data: unknown, location?: string) => {
        if (location) c.header('Location', location);
        const validatedData = parseResponseOrThrow500(responseSchema.shape.data, data);
        return c.json({ data: validatedData }, 201);
      };
    }

    if (statusCodes.includes(204)) {
      responders.noContent = () => c.body(null, 204);
    }

    const typedResponders = responders as unknown as TypedResponders<R, T200, T201>;

    return handler(c, typedResponders);
  };

  return impl as unknown as RouteHandler<R, AppEnv>;
};

export class ResponseValidationError extends Error {
  constructor(
    public zodError: ZodError,
    message?: string,
  ) {
    super(message ?? 'Response validation failed');
    this.name = 'ResponseValidationError';
  }
}

const parseResponseOrThrow500 = <T>(schema: ZodType<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ResponseValidationError(error);
    }
    throw error;
  }
};
