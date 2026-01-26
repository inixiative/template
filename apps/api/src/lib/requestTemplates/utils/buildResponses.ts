import { z } from '@hono/zod-openapi';
import { errorResponses } from '#/lib/requestTemplates/errorResponses';
import { paginateResponseSchema } from '#/lib/requestTemplates/paginationSchemas';
import type { RouteArgs, ZodResponseSchema } from '#/lib/requestTemplates/types';

type SuccessResponse<T extends ZodResponseSchema> = {
  content: { 'application/json': { schema: z.ZodObject<{ data: T }> } };
  description: string;
};

export function buildResponses<const T extends RouteArgs>(args: T, statusCode: 200 | 201 = 200) {
  const { responseSchema, many = false, paginate = false } = args;

  if (responseSchema) {
    const dataSchema = many ? z.array(responseSchema) : responseSchema;
    const schema =
      many && paginate
        ? z.object({ data: dataSchema, pagination: paginateResponseSchema })
        : z.object({ data: dataSchema });

    return {
      [statusCode]: {
        content: { 'application/json': { schema } },
        description: 'Success',
      },
      ...errorResponses,
    } as { [K in typeof statusCode]: SuccessResponse<NonNullable<T['responseSchema']>> } & typeof errorResponses;
  }

  return {
    204: { description: 'Success' },
    ...errorResponses,
  } as { 204: { description: string } } & typeof errorResponses;
}
