import type { RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { Env, TypedResponse } from 'hono';
import { ZodError, type ZodSchema } from 'zod';
import { type ResponseMetadata, ResponseMetadataSchema } from '#/lib/requestTemplates/responseMetadata';
import type { AppEnv } from '#/types/appEnv';

type StatusCodesFromRoute<TRoute extends RouteConfig> = TRoute extends { responses: infer R }
  ? keyof R & number
  : never;

type TypedResponders<TRoute extends RouteConfig, T> = (200 extends StatusCodesFromRoute<TRoute>
  ? { ok: (data: T, metadata?: ResponseMetadata) => TypedResponse }
  : {}) &
  (201 extends StatusCodesFromRoute<TRoute> ? { created: (data: T, location?: string) => TypedResponse } : {}) &
  (204 extends StatusCodesFromRoute<TRoute> ? { noContent: () => TypedResponse } : {});

type ResponderBag<T> = {
  ok?: (data: T, metadata?: ResponseMetadata) => TypedResponse;
  created?: (data: T, location?: string) => TypedResponse;
  noContent?: () => TypedResponse;
};

// Extract the context type from RouteHandler
type RouteContext<R extends RouteConfig, E extends Env> = Parameters<RouteHandler<R, E>>[0];

export const makeController = <R extends RouteConfig, T>(
  route: R,
  handler: (c: RouteContext<R, AppEnv>, respond: TypedResponders<R, T>) => TypedResponse | Promise<TypedResponse>,
): RouteHandler<R, AppEnv> => {
  const impl = (c: RouteContext<R, AppEnv>) => {
    const statusCodes = Object.keys(route.responses || {}).map(Number);
    const responders: ResponderBag<T> = {};

    if (statusCodes.includes(200) && route.responses?.[200]) {
      const response = route.responses[200] as { content: { 'application/json': { schema: any } } };
      const responseSchema = response.content['application/json'].schema;
      if (!responseSchema) throw new Error('Route declares 200 response but missing schema');
      responders.ok = (data: T, metadata?: ResponseMetadata) => {
        const dataSchema = responseSchema.shape.data;
        const validatedData = parseResponseOrThrow500(dataSchema, data);

        const responseObj: any = { data: validatedData };

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
      const response = route.responses[201] as { content: { 'application/json': { schema: any } } };
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
