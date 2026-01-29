import { z } from '@hono/zod-openapi';

export const idParamsSchema = z.object({
  id: z
    .string()
    .uuid()
    .openapi({
      param: { in: 'path' },
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
});
