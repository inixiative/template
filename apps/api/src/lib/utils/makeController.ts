import type { RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { PaginationMetadata } from '@src/lib/requestTemplates/paginationSchemas';
import type { AppEnv } from '@src/types/appEnv';
import type { Env, TypedResponse } from 'hono';
import { ZodError, type ZodSchema } from 'zod';

type StatusCodesFromRoute<TRoute extends RouteConfig> = TRoute extends { responses: infer R }
  ? keyof R & number
  : never;

type TypedResponders<TRoute extends RouteConfig, T> = (200 extends StatusCodesFromRoute<TRoute>
  ? { ok: (data: T, metadata?: { pagination?: PaginationMetadata }) => TypedResponse }
  : {}) &
  (201 extends StatusCodesFromRoute<TRoute> ? { created: (data: T, location?: string) => TypedResponse } : {}) &
  (204 extends StatusCodesFromRoute<TRoute> ? { noContent: () => TypedResponse } : {});

type ResponderBag<T> = {
  ok?: (data: T, metadata?: { pagination?: PaginationMetadata }) => TypedResponse;
  created?: (data: T, location?: string) => TypedResponse;
  noContent?: () => TypedResponse;
};

// Extract the context type from RouteHandler
type RouteContext<R extends RouteConfig, E extends Env> = Parameters<RouteHandler<R, E>>[0];

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

// Serialize Prisma data (handle BigInt, Decimal, Date)
const serializeData = (data: unknown): unknown => {
  if (data === null || data === undefined) return data;
  if (typeof data === 'bigint') return data.toString();
  if (data instanceof Date) return data.toISOString();
  if (typeof data === 'object' && 'toNumber' in data) return (data as { toNumber: () => number }).toNumber(); // Decimal
  if (Array.isArray(data)) return data.map(serializeData);
  if (typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, serializeData(v)]),
    );
  }
  return data;
};

export const makeController = <R extends RouteConfig, T>(
  route: R,
  handler: (c: RouteContext<R, AppEnv>, respond: TypedResponders<R, T>) => TypedResponse | Promise<TypedResponse>,
): RouteHandler<R, AppEnv> => {
  const impl = (c: RouteContext<R, AppEnv>) => {
    const statusCodes = Object.keys(route.responses || {}).map(Number);
    const responders: ResponderBag<T> = {};

    if (statusCodes.includes(200) && route.responses?.[200]) {
      const response = route.responses[200] as { content: { 'application/json': { schema: ZodSchema } } };
      const responseSchema = response.content['application/json'].schema;
      if (!responseSchema) throw new Error('Route declares 200 response but missing schema');

      responders.ok = (data: T, metadata?: { pagination?: PaginationMetadata }) => {
        const serializedData = serializeData(data);
        const dataSchema = (responseSchema as { shape: { data: ZodSchema } }).shape.data;
        const validatedData = parseResponseOrThrow500(dataSchema, serializedData);

        const responseObj: Record<string, unknown> = { data: validatedData };

        if (metadata?.pagination) {
          responseObj.pagination = metadata.pagination;
        }

        return c.json(responseObj, 200);
      };
    }

    if (statusCodes.includes(201) && route.responses?.[201]) {
      const response = route.responses[201] as { content: { 'application/json': { schema: ZodSchema } } };
      const responseSchema = response.content['application/json'].schema;
      if (!responseSchema) throw new Error('Route declares 201 response but missing schema');

      responders.created = (data: T, location?: string) => {
        if (location) c.header('Location', location);
        const serializedData = serializeData(data);
        const dataSchema = (responseSchema as { shape: { data: ZodSchema } }).shape.data;
        const validatedData = parseResponseOrThrow500(dataSchema, serializedData);
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
