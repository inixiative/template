import { Prisma } from '@prisma/client';
import { clearCacheKey } from 'src/shared/cache/clearCache';
import type { HookFunction, HookOptions } from 'src/plugins/prisma/extensions/mutationLifeCycle';
import { cacheKeyPatterns } from 'src/plugins/prisma/extensions/cachePatterns';

const getCacheKeys = (model: string, record: any): string[] => {
  if (!record || !cacheKeyPatterns[model]) return [];
  
  try {
    return cacheKeyPatterns[model]!(record);
  } catch (error) {
    console.error(`Error generating cache keys for ${model}:`, error);
    return [];
  }
};

export const clearCacheExtension: HookFunction = async (app, options) => {
  if (process.env.SKIP_CACHE_CLEAR === 'true') return;
  
  const { model, result } = options;
  
  if (!result) return;
  
  const keys = getCacheKeys(model, result);
  
  await Promise.all(
    keys.map(async (pattern) => {
      try {
        await clearCacheKey(app.redis.cache, pattern);
      } catch (error) {
        console.error(`Error clearing cache for pattern ${pattern}:`, error);
      }
    })
  );
};