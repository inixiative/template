import { z } from '@hono/zod-openapi';

export const simpleSearchSchema = z
  .string()
  .optional()
  .openapi({
    param: { in: 'query' },
    example: 'john',
    description: 'Search across all searchable fields',
  });

export const advancedSearchSchema = z
  .record(z.string(), z.string())
  .optional()
  .openapi({
    param: { in: 'query' },
    example: { name: 'john', email: 'example.com' },
    description: 'Search specific fields',
  });

export const createAdvancedSearchSchema = (searchableFields: string[]) => {
  return z
    .record(z.string(), z.string())
    .optional()
    .openapi({
      param: { in: 'query' },
      description: `Search specific fields (allowed: ${searchableFields.join(', ')})`,
    });
};
