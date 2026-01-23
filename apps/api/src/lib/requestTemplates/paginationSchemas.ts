import { z } from '@hono/zod-openapi';

export const paginateRequestSchema = z
  .object({
    page: z.coerce
      .number()
      .min(1)
      .default(1)
      .openapi({
        param: { in: 'query' },
        example: 1,
      }),
    pageSize: z.coerce
      .number()
      .min(1)
      .max(10000)
      .default(10)
      .openapi({
        param: { in: 'query' },
        example: 10,
      }),
  })
  .openapi('PaginateRequest');

export const paginateResponseSchema = z
  .object({
    page: z.number().min(1).default(1).openapi({ example: 1 }),
    pageSize: z.number().min(1).max(10000).default(10).openapi({ example: 10 }),
    total: z.number().min(0).default(0).openapi({ example: 100 }),
    totalPages: z.number().min(0).default(0).openapi({ example: 10 }),
  })
  .openapi('PaginateResponse');

export type PaginationMetadata = z.infer<typeof paginateResponseSchema>;
