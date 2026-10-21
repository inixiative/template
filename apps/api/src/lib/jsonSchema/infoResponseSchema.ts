/**
 * @atlas
 * @kind schema
 * @partOf primitive:routeTemplates
 * @uses none
 */
import { z } from '@hono/zod-openapi';

export const infoResponseSchema = <T extends z.ZodType>(types: T) =>
  z.object({
    guide: z
      .record(z.string(), z.string())
      .describe(
        'What each key under `types` means, by dotted path. `*` is any key, `[]` any item.',
      ),
    types: types.describe('What this module accepts, per the guide.'),
  });
