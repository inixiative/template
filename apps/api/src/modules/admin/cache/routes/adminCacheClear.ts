import { z } from '@hono/zod-openapi';
import { actionRoute } from '#/lib/routeTemplates/action';
import { Modules } from '#/modules/modules';

const cacheKeySchema = z.object({
  model: z.string().optional().describe('Model name. Required with value, or omit both to clear all.'),
  value: z.string().optional().describe('The value to match (e.g., user ID, email)'),
  field: z.string().default('id').describe('Field name (default: "id")'),
  tags: z.array(z.string()).default([]).describe('Additional tags'),
  wildcard: z.boolean().default(true).describe('Whether to append wildcard (*)'),
});

const responseSchema = z.object({
  pattern: z.string(),
  deleted: z.number(),
});

export const adminCacheClearRoute = actionRoute({
  model: Modules.cache,
  action: 'clear',
  admin: true,
  skipId: true,
  description: 'Clear cache entries by pattern. Send empty object {} to clear entire cache.',
  bodySchema: cacheKeySchema,
  responseSchema,
});
