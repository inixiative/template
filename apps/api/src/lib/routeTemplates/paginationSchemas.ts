/**
 * @atlas
 * @kind schema
 * @partOf primitive:routeTemplates
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { orderByRequestSchema } from '#/lib/routeTemplates/orderBySchema';

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
      .max(10_000)
      .default(10)
      .openapi({
        param: { in: 'query' },
        example: 10,
      }),
    orderBy: orderByRequestSchema,
  })
  .openapi('PaginateRequest');

export const paginateResponseSchema = z
  .object({
    page: z.number().min(1).default(1).openapi({ example: 1 }),
    pageSize: z.number().min(1).max(10_000).default(10).openapi({ example: 10 }),
    total: z.number().min(0).default(0).openapi({ example: 100 }),
    totalPages: z.number().min(0).default(0).openapi({ example: 10 }),
  })
  .openapi('PaginateResponse');

export type PaginationMetadata = z.infer<typeof paginateResponseSchema>;

// Cursor mode trades random access for stability: no page number, no total, no totalPages, and
// no count() on the read path. Jump-to-end is served by flipping the sort direction.
export const cursorPaginateRequestSchema = z
  .object({
    pageSize: z.coerce
      .number()
      .min(1)
      .max(10_000)
      .default(100)
      .openapi({
        param: { in: 'query' },
        example: 100,
      }),
    cursor: z
      .string()
      .optional()
      .openapi({
        param: { in: 'query' },
        example: 'eyJ2IjoxLCJrIjpbWyJpZCIsImFzYyJdXSwicCI6WyIuLi4iXX0',
      }),
    orderBy: orderByRequestSchema,
  })
  .openapi('CursorPaginateRequest');

export const cursorPaginateResponseSchema = z
  .object({
    pageSize: z.number().min(1).max(10_000).openapi({ example: 100 }),
    hasMore: z.boolean().openapi({ example: true }),
    nextCursor: z.string().nullable().openapi({ example: null }),
  })
  .openapi('CursorPaginateResponse');

export type CursorPaginationMetadata = z.infer<typeof cursorPaginateResponseSchema>;
