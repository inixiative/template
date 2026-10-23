/**
 * @atlas
 * @kind constructor, utils
 * @partOf primitive:routeTemplates
 * @uses none
 * @constructs controller
 */
import type { RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { Env, TypedResponse } from 'hono';
import { ZodError, type ZodSchema, z } from 'zod';
import {
  type ResponseMetadata,
  ResponseMetadataSchema,
} from '#/lib/routeTemplates/responseMetadata';
import type { RouteArgs } from '#/lib/routeTemplates/types';
import { isAuthProbe } from '#/lib/utils/authProbe';
import type { AppEnv } from '#/types/appEnv';

type EmptyRecord = Record<never, never>;
type StatusCodesFromRoute<TRoute extends RouteConfig> = TRoute extends { responses: infer R }
  ? keyof R & number
  : never;

type TypedResponders<TRoute extends RouteConfig, T> = (200 extends StatusCodesFromRoute<TRoute>
  ? { ok: (data: T, metadata?: ResponseMetadata) => TypedResponse }
  : EmptyRecord) &
  (201 extends StatusCodesFromRoute<TRoute>
    ? { created: (data: T, location?: string) => TypedResponse }
    : EmptyRecord) &
  (204 extends StatusCodesFromRoute<TRoute> ? { noContent: () => TypedResponse } : EmptyRecord);

type ResponderBag<T> = {
  ok?: (data: T, metadata?: ResponseMetadata) => TypedResponse;
  created?: (data: T, location?: string) => TypedResponse;
  noContent?: () => TypedResponse;
};

type JsonResponseSchema = {
  shape: {
    data: ZodSchema<unknown>;
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
  pagination?: ResponseMetadata['pagination'];
};

type RefinableRoute = Pick<RouteArgs, 'bodyRefinement' | 'queryRefinement' | 'paramsRefinement'>;

type ValidatedRequest = { valid: (target: 'json' | 'query' | 'param') => unknown };

// Extract the context type from RouteHandler
type RouteContext<R extends RouteConfig, E extends Env> = Parameters<RouteHandler<R, E>>[0];

export const makeController = <R extends RouteConfig, T>(
  route: R,
  handler: (
    c: RouteContext<R, AppEnv>,
    respond: TypedResponders<R, T>,
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
    c.set('routeConfig', route);

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
    const responders: ResponderBag<T> = {};

    if (statusCodes.includes(200) && route.responses?.[200]) {
      const response = route.responses[200] as unknown as JsonResponseDefinition;
      const responseSchema = response.content['application/json'].schema;
      if (!responseSchema) throw new Error('Route declares 200 response but missing schema');
      responders.ok = (data: T, metadata?: ResponseMetadata) => {
        const dataSchema = responseSchema.shape.data;
        const validatedData = parseResponseOrThrow500(dataSchema, data);

        const responseObj: JsonResponseBody = { data: validatedData };

        if (metadata) {
          const validatedMetadata = parseResponseOrThrow500(ResponseMetadataSchema, metadata);

          if (validatedMetadata.pagination) {
            responseObj.pagination = validatedMetadata.pagination;
          }
        }

        return c.json(responseObj, 200);
      };
    }

    if (statusCodes.includes(201) && route.responses?.[201]) {
      const response = route.responses[201] as unknown as JsonResponseDefinition;
      const responseSchema = response.content['application/json'].schema;
      if (!responseSchema) throw new Error('Route declares 201 response but missing schema');
      responders.created = (data: T, location?: string) => {
        if (location) c.header('Location', location);
        const dataSchema = responseSchema.shape.data;
        const validatedData = parseResponseOrThrow500(dataSchema, data);
        return c.json({ data: validatedData }, 201);
      };
    }

    if (statusCodes.includes(204)) {
      responders.noContent = () => c.body(null, 204);
    }

    const typedResponders = responders as unknown as TypedResponders<R, T>;

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

const parseResponseOrThrow500 = <T>(schema: ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ResponseValidationError(error);
    }
    throw error;
  }
};
