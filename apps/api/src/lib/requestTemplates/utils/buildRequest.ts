import type { Prisma } from '@template/db';
import { z } from '@hono/zod-openapi';
import { idParamsSchema } from '#/lib/requestTemplates/idParamsSchema';
import { paginateRequestSchema } from '#/lib/requestTemplates/paginationSchemas';
import type { RouteArgs, ZodSchema } from '#/lib/requestTemplates/types';
import { sanitizeRequestSchema } from '#/lib/requestTemplates/utils/sanitizeRequestSchema';

// Base system fields that get sanitized from body schemas
type BaseSanitizeKey = 'id' | 'uuid' | 'createdAt' | 'updatedAt' | 'deletedAt';

// Cast helper - forces T through unknown to target type U
type Cast<T, U> = T extends unknown ? U : never;

// Transform `unknown` to Prisma's JSON input type via cast through unknown
type TransformUnknown<T> = unknown extends T
  ? Cast<T, Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue>
  : T;

// Transform all properties in an object type
type TransformShape<S> = {
  [K in keyof S]: S[K] extends z.ZodType<infer Output, infer Def, infer Input>
    ? z.ZodType<TransformUnknown<Output>, Def, TransformUnknown<Input>>
    : S[K];
};

// Type that represents a sanitized body schema with base keys removed and JSON fields cast to Prisma types
type SanitizedBodySchema<T extends ZodSchema> = z.ZodObject<TransformShape<Omit<T['shape'], BaseSanitizeKey>>>;

// Need ID when: not skipId AND (has submodel OR not many)
type NeedsId<T extends RouteArgs> = T['skipId'] extends true
  ? false
  : T['submodel'] extends string
    ? true
    : T['many'] extends true
      ? false
      : true;

type ParamsType<T extends RouteArgs> = T['params'] extends ZodSchema
  ? T['params']
  : NeedsId<T> extends true
    ? typeof idParamsSchema
    : z.ZodObject<{}>;

type PaginateShape = (typeof paginateRequestSchema)['shape'];

type MergedQuery<Q extends ZodSchema> = Q extends z.ZodObject<infer Shape>
  ? z.ZodObject<Shape & PaginateShape>
  : typeof paginateRequestSchema;

type QueryType<T extends RouteArgs> = T['paginate'] extends true
  ? T['query'] extends ZodSchema
    ? MergedQuery<T['query']>
    : typeof paginateRequestSchema
  : T['query'] extends ZodSchema
    ? T['query']
    : z.ZodObject<{}>;

type RequestWithBody<T extends RouteArgs> = {
  params: ParamsType<T>;
  query: QueryType<T>;
  body: {
    content: { 'application/json': { schema: SanitizedBodySchema<NonNullable<T['bodySchema']>> } };
    required: true;
  };
};

type RequestWithoutBody<T extends RouteArgs> = {
  params: ParamsType<T>;
  query: QueryType<T>;
};

export function buildRequest<const T extends RouteArgs>(
  args: T,
): T['bodySchema'] extends ZodSchema ? RequestWithBody<T> : RequestWithoutBody<T> {
  const { params, query, bodySchema, sanitizeKeys = [], skipId = false, paginate = false, many = false } = args;

  // Need ID when: not skipId AND (has submodel OR not many)
  // With submodel + many: getting all submodels for a parent, so need parent ID
  const needsId = !skipId && (args.submodel || !many);
  const paramsSchema = params ?? (needsId ? idParamsSchema : z.object({}));
  const baseQuerySchema = query ?? z.object({});
  const querySchema = many && paginate ? baseQuerySchema.merge(paginateRequestSchema) : baseQuerySchema;
  const sanitizedBodySchema = bodySchema ? sanitizeRequestSchema(bodySchema, sanitizeKeys) : undefined;
  const finalBodySchema = sanitizedBodySchema ? (many ? z.array(sanitizedBodySchema) : sanitizedBodySchema) : undefined;

  if (finalBodySchema) {
    return {
      params: paramsSchema,
      query: querySchema,
      body: {
        content: { 'application/json': { schema: finalBodySchema } },
        required: true as const,
      },
    } as T['bodySchema'] extends ZodSchema ? RequestWithBody<T> : RequestWithoutBody<T>;
  }

  return {
    params: paramsSchema,
    query: querySchema,
  } as T['bodySchema'] extends ZodSchema ? RequestWithBody<T> : RequestWithoutBody<T>;
}
