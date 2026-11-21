/**
 * @atlas
 * @kind controller
 * @partOf feature:setting
 * @uses infrastructure:prisma, primitive:authz
 */
import { resolveEffectiveAttributeValues } from '@template/db';
import type {
  SettingCategoryKey,
  SettingKey,
  SettingPermissionAction,
} from '@template/shared/settings';
import { makeController } from '#/lib/utils/makeController';
import { settingReadManyRoute } from '#/modules/setting/routes/settingReadMany';
import {
  authorizeSettingTarget,
  fetchSettingTarget,
} from '#/modules/setting/services/fetchSettingTarget';

export const settingReadManyController = makeController(
  settingReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permix = c.get('permix');
    const query = c.req.valid('query');

    const target = await fetchSettingTarget(query);
    await authorizeSettingTarget(permix, target, 'read');

    const rows = await db.setting.findMany({
      where: {
        resourceModel: target.resourceModel,
        ...target.targetFks,
        ...(query.key ? { key: query.key } : {}),
      },
    });

    const { items } = resolveEffectiveAttributeValues('setting', target.resourceModel, rows, {
      category: query.category,
      key: query.key,
    });

    return respond.ok(
      items.map((item) => ({
        ...item,
        key: item.key as SettingKey,
        category: item.category as SettingCategoryKey,
        permission: item.permission as SettingPermissionAction,
      })),
    );
  },
);
