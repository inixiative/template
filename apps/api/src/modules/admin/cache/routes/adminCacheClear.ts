import { z } from '@hono/zod-openapi';
import { actionRoute } from '#/lib/requestTemplates/action';
import { Modules } from '#/modules/modules';

const cacheKeySchema = z
  .object({
    model: z.string().describe('Model name (e.g., "User", "Organization")'),
    value: z.string().describe('The value to match (e.g., user ID, email)'),
    field: z.string().default('id').describe('Field name (default: "id")'),
    tags: z.array(z.string()).default([]).describe('Additional tags'),
    wildcard: z.boolean().default(false).describe('Whether to append wildcard (*)'),
  })
  .nullable()
  .optional()
  .describe('Cache key pattern. If null/omitted, clears entire cache.');

const responseSchema = z.object({
  pattern: z.string(),
  deleted: z.number(),
});

export const adminCacheClearRoute = actionRoute({
  model: Modules.cache,
  action: 'clear',
  admin: true,
  skipId: true,
  description: 'Clear cache entries by pattern. Omit body to clear entire cache.',
  body: cacheKeySchema,
  response: responseSchema,
});
