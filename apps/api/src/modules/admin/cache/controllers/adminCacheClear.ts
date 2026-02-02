import { cacheKey, clearKey, redisNamespace } from '@template/db';
import { makeController } from '#/lib/utils/makeController';
import { adminCacheClearRoute } from '#/modules/admin/cache/routes/adminCacheClear';

export const adminCacheClearController = makeController(adminCacheClearRoute, async (c, respond) => {
  const { model, value, field, tags, wildcard } = c.req.valid('json');

  let pattern: string;

  if (!model) {
    pattern = `${redisNamespace.cache}:*`;
  } else {
    // Build identifier from field/value for backwards compatibility
    const identifier = field === 'id' ? (value ?? '') : { [field]: value ?? '' };
    pattern = cacheKey(model, identifier, tags, wildcard);
  }

  const deleted = await clearKey(pattern);

  return respond.ok({ pattern, deleted });
});
