import type { RouteHandler } from '@hono/zod-openapi';
import { cacheKey } from '#/lib/cache/cache';
import { clearCacheKey } from '#/lib/cache/clearCacheKey';
import { redisNamespace } from '#/lib/clients/redisNamespaces';
import type { adminCacheClearRoute } from '#/modules/admin/cache/routes/adminCacheClear';

export const adminCacheClearController: RouteHandler<typeof adminCacheClearRoute> = async (c) => {
  const body = c.req.valid('json');

  let pattern: string;

  if (!body) {
    // Clear entire cache
    pattern = `${redisNamespace.cache}:*`;
  } else {
    // Build pattern from key parts
    pattern = cacheKey(body.model, body.value, body.field, body.tags, body.wildcard);
  }

  const deleted = await clearCacheKey(pattern);

  return c.json({ data: { pattern, deleted } });
};
