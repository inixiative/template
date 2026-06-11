/**
 * @atlas
 * @kind utils
 * @partOf primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';
import type { Prisma } from '@template/db';
import { searchablePaths } from '@template/db/lens';
import { buildOrderBySchema } from '#/lib/routeTemplates/filters/buildOrderBySchema';
import { buildSearchFieldsSchema } from '#/lib/routeTemplates/filters/buildSearchFieldsSchema';
import { idParamsSchema } from '#/lib/routeTemplates/idParamsSchema';
import { paginateRequestSchema } from '#/lib/routeTemplates/paginationSchemas';
import { createAdvancedSearchSchema, simpleSearchSchema } from '#/lib/routeTemplates/searchSchema';
import type { RouteArgs, ZodSchema } from '#/lib/routeTemplates/types';
import { hasIdParam } from '#/lib/routeTemplates/utils/hasIdParam';
import { sanitizeRequestSchema } from '#/lib/routeTemplates/utils/sanitizeRequestSchema';

// biome-ignore lint/complexity/noBannedTypes: Zod generic requires {}
type ZodAnyObject = z.ZodObject<{}>;

// Base system fields that get sanitized from body schemas
type BaseSanitizeKey = 'id' | 'uuid' | 'createdAt' | 'updatedAt' | 'deletedAt';

// Cast helper - forces T through unknown to target type U
type Cast<T, U> = T extends unknown ? U : never;

// Transform `unknown` to Prisma's JSON input type via cast through unknown
type TransformUnknown<T> = unknown extends T ? Cast<T, Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue> : T;

// Transform all properties in an object type
type TransformShape<S> = {
  [K in keyof S]: S[K] extends z.ZodType<infer Output, infer Input>
    ? z.ZodType<TransformUnknown<Output>, TransformUnknown<Input>>
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
    : ZodAnyObject;

type PaginateShape = (typeof paginateRequestSchema)['shape'];

type MergedQuery<Q extends ZodSchema> =
  Q extends z.ZodObject<infer Shape> ? z.ZodObject<Shape & PaginateShape> : typeof paginateRequestSchema;

type QueryType<T extends RouteArgs> = T['paginate'] extends true
  ? T['query'] extends ZodSchema
    ? MergedQuery<T['query']>
    : typeof paginateRequestSchema
  : T['query'] extends ZodSchema
    ? T['query']
    : ZodAnyObject;

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

export const buildRequest = <const T extends RouteArgs>(
  args: T,
): T['bodySchema'] extends ZodSchema ? RequestWithBody<T> : RequestWithoutBody<T> => {
  const {
    params,
    query,
    bodySchema,
    sanitizeKeys = [] as readonly string[],
    skipId = false,
    paginate = false,
    many = false,
    admin = false,
    filterLens,
  } = args;

  const searchableFields = filterLens ? searchablePaths(filterLens) : undefined;

  // Need ID when: not skipId AND (has submodel OR not many)
  // With submodel + many: getting all submodels for a parent, so need parent ID
  const needsId = hasIdParam(skipId, args.submodel, many);
  const paramsSchema = params ?? (needsId ? idParamsSchema : z.object({}));

  let querySchema = query ?? z.object({});

  // Add lookup parameter for routes with id params
  if (needsId) {
    querySchema = querySchema.merge(z.object({ lookup: z.string().optional() }));
  }

  if (many && paginate) querySchema = querySchema.merge(paginateRequestSchema);

  // Lens-constrained orderBy (enum of orderable fields) overrides the generic one.
  if (filterLens) {
    const orderBy = buildOrderBySchema(filterLens);
    if (orderBy) querySchema = querySchema.merge(z.object({ orderBy }));
  }

  // Admin routes have unlocked search at runtime (paginate.ts skips field
  // validation when isSuperadmin), so always expose the searchFields schema
  // for them. With a filterLens we emit the typed, prisma-where-shaped schema;
  // otherwise (admin without a lens) fall back to the loose record schema.
  if (admin || searchableFields?.length) {
    const searchFields =
      (filterLens && buildSearchFieldsSchema(filterLens)) || createAdvancedSearchSchema(searchableFields ?? []);
    querySchema = querySchema.merge(z.object({ search: simpleSearchSchema, searchFields }));
  }

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
};
