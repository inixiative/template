import { cacheKey } from '#/lib/cache/cache';
import { clearCacheKey } from '#/lib/cache/clearCacheKey';
import { redisNamespace } from '#/lib/clients/redisNamespaces';
import { makeController } from '#/lib/utils/makeController';
import { adminCacheClearRoute } from '#/modules/admin/cache/routes/adminCacheClear';

export const adminCacheClearController = makeController(adminCacheClearRoute, async (c, respond) => {
  const { model, value, field, tags, wildcard } = c.req.valid('json');

  let pattern: string;

  if (!model) {
    pattern = `${redisNamespace.cache}:*`;
  } else {
    pattern = cacheKey(model, value ?? '', field, tags, wildcard);
  }

  const deleted = await clearCacheKey(pattern);

  return respond.ok({ pattern, deleted });
});
