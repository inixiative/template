/**
 * @atlas
 * @kind service
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import { db } from '@template/db/client';
import {
  type AnyRollingCacheTargets,
  MAX_ROLLING_CACHE_TARGETS,
} from '@template/db/redis/rollingCacheTypes';

// Runs the selector's findMany args as given, capped one past MAX_ROLLING_CACHE_TARGETS so an
// oversized selector throws instead of resolving partially.
export const resolveRollingCacheTargets = async ({
  model,
  args,
}: AnyRollingCacheTargets): Promise<Record<string, unknown>[]> => {
  const rows = await db.delegate(model).findMany({ ...args, take: MAX_ROLLING_CACHE_TARGETS + 1 });
  if (rows.length > MAX_ROLLING_CACHE_TARGETS) {
    throw new Error(
      `Rolling cache targets on ${model} exceed ${MAX_ROLLING_CACHE_TARGETS} - narrow the selector or raise the ceiling deliberately.`,
    );
  }
  return rows;
};
