/**
 * @atlas
 * @kind schema
 * @partOf primitive:routeTemplates
 * @uses none
 */
import { z } from '@hono/zod-openapi';

// `id` is intentionally lax at the schema level so the same routes can be
// addressed by uuid OR by an alternate field via `?lookup=`. UUID-format
// enforcement when lookup is absent lives in resourceContextMiddleware,
// where it can read the lookup query alongside the param.
export const idParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: { in: 'path' },
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
});
