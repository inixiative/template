/**
 * @atlas
 * @kind schema
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import { z } from 'zod';

export type ListStreamRow = { id: string; updatedAt: string };

const listStreamPaginationSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export type ListStreamPagination = z.infer<typeof listStreamPaginationSchema>;

export const listStreamRemovalSchema = z.object({ id: z.string(), updatedAt: z.iso.datetime() });

export type ListStreamRemoval = z.infer<typeof listStreamRemovalSchema>;

export const listStreamSchemas = <R extends z.ZodType<ListStreamRow>>(row: R) => ({
  snapshot: z.object({ data: z.array(row), pagination: listStreamPaginationSchema.optional() }),
  actions: { upsert: row, remove: listStreamRemovalSchema },
});
