/**
 * @atlas
 * @kind controller
 * @partOf feature:setting
 * @uses infrastructure:prisma, primitive:authz, primitive:errors
 */
import { type HydratedRecord, resolveEffectiveAttributeValues } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import {
  type SettingCategoryKey,
  type SettingKey,
  type SettingPermissionAction,
  settingDefinitionsForResourceModel,
} from '@template/shared/settings';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { settingReadManyRoute } from '#/modules/setting/routes/settingReadMany';
import {
  fetchSettingTarget,
  hydrateSettingTarget,
} from '#/modules/setting/services/fetchSettingTarget';

export const settingReadManyController = makeController(
  settingReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permix = c.get('permix');
    const query = c.req.valid('query');

    const target = await fetchSettingTarget(query);
    const hydratedBase = await hydrateSettingTarget(target);

    const allDefinitions = settingDefinitionsForResourceModel(target.resourceModel);
    const canReadKey = (key: string) =>
      check(permix, rebacSchema, 'setting', { ...hydratedBase, key } as HydratedRecord, 'read');

    const filteredDefinitions = allDefinitions.filter((definition) => {
      if (query.category && definition.category !== query.category) return false;
      if (query.key && definition.key !== query.key) return false;
      return true;
    });

    const readableKeys = new Set(
      filteredDefinitions.filter((definition) => canReadKey(definition.key)).map((d) => d.key),
    );

    if (
      (filteredDefinitions.length > 0 && readableKeys.size === 0) ||
      (filteredDefinitions.length === 0 &&
        allDefinitions.length > 0 &&
        !allDefinitions.some((definition) => canReadKey(definition.key)))
    ) {
      throw makeError({ status: 403, message: 'Access denied' });
    }

    const rows =
      readableKeys.size === 0
        ? []
        : await db.setting.findMany({
            where: {
              resourceModel: target.resourceModel,
              ...target.targetFks,
              key: { in: [...readableKeys] },
            },
          });

    const { items } = resolveEffectiveAttributeValues('setting', target.resourceModel, rows, {
      category: query.category,
      key: query.key,
    });

    return respond.ok(
      items
        .filter((item) => readableKeys.has(item.key))
        .map(({ recordId, ...item }) => ({
          ...item,
          key: item.key as SettingKey,
          category: item.category as SettingCategoryKey,
          permission: item.permission as SettingPermissionAction,
          settingId: recordId,
        })),
    );
  },
);
