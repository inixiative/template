/**
 * @atlas
 * @kind service
 * @partOf feature:setting
 * @uses infrastructure:prisma, primitive:authz, primitive:caching
 */
import {
  cacheKey,
  fetchThroughCache,
  type HydratedRecord,
  hydrate,
  polymorphicArmKeys,
} from '@template/db';
import type { Setting } from '@template/db/generated/client/client';
import type { SettingResourceModel } from '@template/db/generated/client/enums';
import { check } from '@template/permissions/rebac';
import { settingDefinitionsForResourceModel } from '@template/shared/settings';
import type { Context } from 'hono';
import type { SettingListQuery } from '#/modules/setting/schemas/settingSchemas';
import type { AppEnv } from '#/types/appEnv';

/**
 * Shared reader for all 8 parent-scoped `GET /.../settings` routes.
 * Parent `read` access is enforced on the route via `validatePermission('read')`;
 * raw not-deleted rows for `(resourceModel, resourceId)` are cached in Redis via `fetchThroughCache`
 * (invalidated automatically by `cacheKeysByModel.Setting`), then filtered in memory per key
 * through `db:Setting:read` and optional `category`/`key` filters.
 */
export const readResourceSettings = async (
  c: Context<AppEnv>,
  resourceModel: SettingResourceModel,
  query: SettingListQuery,
): Promise<Setting[]> => {
  const db = c.get('db');
  const permix = c.get('permix');
  const resource = c.get('resource') as Record<string, unknown>;
  const resourceId = resource.id as string;
  const targetFks = polymorphicArmKeys('Setting', 'resourceModel', resourceModel, resource);

  const definitions = settingDefinitionsForResourceModel(resourceModel).filter((definition) => {
    if (query.category && definition.category !== query.category) return false;
    if (query.key && definition.key !== query.key) return false;
    return true;
  });

  if (definitions.length === 0) return [];

  const hydratedBase = await hydrate('setting', {
    id: '',
    resourceModel,
    resourceId,
    ...targetFks,
  } as HydratedRecord);

  const readableKeys = new Set(
    definitions
      .filter((definition) =>
        check(
          permix,
          'setting',
          { ...hydratedBase, key: definition.key } as HydratedRecord,
          'read',
        ),
      )
      .map((definition) => definition.key),
  );

  if (readableKeys.size === 0) return [];

  const rows = await fetchThroughCache<Setting[]>(
    cacheKey('setting', { resourceModel, resourceId }),
    () =>
      db.setting.findMany({
        where: {
          resourceModel,
          ...targetFks,
        },
        orderBy: { key: 'asc' },
      }),
  );

  return rows.filter((row) => readableKeys.has(row.key));
};
