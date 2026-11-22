/**
 * @atlas
 * @kind utils
 * @partOf primitive:routeTemplates
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { errorResponses } from '#/lib/routeTemplates/errorResponses';
import {
  cursorPaginateResponseSchema,
  paginateResponseSchema,
} from '#/lib/routeTemplates/paginationSchemas';
import type { RouteArgs, ZodResponseSchema } from '#/lib/routeTemplates/types';

type ResponseDataSchema<T extends RouteArgs> = T['many'] extends true
  ? z.ZodArray<NonNullable<T['responseSchema']>>
  : NonNullable<T['responseSchema']>;

type ResponseBodySchema<T extends RouteArgs> = T['many'] extends true
  ? T['paginate'] extends 'cursor'
    ? z.ZodObject<{
        data: ResponseDataSchema<T>;
        pagination: typeof cursorPaginateResponseSchema;
      }>
    : T['paginate'] extends true
      ? z.ZodObject<{
          data: ResponseDataSchema<T>;
          pagination: typeof paginateResponseSchema;
        }>
      : z.ZodObject<{ data: ResponseDataSchema<T> }>
  : z.ZodObject<{ data: ResponseDataSchema<T> }>;

type SuccessResponse<Schema extends z.ZodType> = {
  content: { 'application/json': { schema: Schema } };
  description: string;
};

type BuiltResponses<
  T extends RouteArgs,
  S extends 200 | 201,
> = T['responseSchema'] extends ZodResponseSchema
  ? { [K in S]: SuccessResponse<ResponseBodySchema<T>> } & typeof errorResponses
  : { 204: { description: string } } & typeof errorResponses;

export const buildResponses = <const T extends RouteArgs, const S extends 200 | 201 = 200>(
  args: T,
  statusCode: S = 200 as S,
): BuiltResponses<T, S> => {
  const { responseSchema, many = false, paginate = false } = args;

  if (responseSchema) {
    const dataSchema = many ? z.array(responseSchema) : responseSchema;
    const schema =
      many && paginate
        ? z.object({
            data: dataSchema,
            pagination:
              paginate === 'cursor' ? cursorPaginateResponseSchema : paginateResponseSchema,
          })
        : z.object({ data: dataSchema });

    return {
      [statusCode]: {
        content: { 'application/json': { schema } },
        description: 'Success',
      },
      ...errorResponses,
    } as unknown as BuiltResponses<T, S>;
  }

  return {
    204: { description: 'Success' },
    ...errorResponses,
  } as unknown as BuiltResponses<T, S>;
};
