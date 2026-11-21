/**
 * @atlas
 * @kind controller
 * @partOf feature:setting
 * @uses infrastructure:prisma, primitive:authz
 */
import { makeController } from '#/lib/utils/makeController';
import { settingUpdateRoute } from '#/modules/setting/routes/settingUpdate';
import { formatSettingRow } from '#/modules/setting/schemas/settingSchemas';
import {
  authorizeSettingTarget,
  fetchSettingTarget,
} from '#/modules/setting/services/fetchSettingTarget';
import { upsertSetting } from '#/modules/setting/services/upsertSetting';

export const settingUpdateController = makeController(settingUpdateRoute, async (c, respond) => {
  const permix = c.get('permix');
  const body = c.req.valid('json');

  const target = await fetchSettingTarget(body);
  await authorizeSettingTarget(permix, target, body.key, 'manage');

  const saved = await upsertSetting({
    target,
    key: body.key,
    value: body.value,
    disabled: body.disabled,
  });

  return respond.ok(formatSettingRow(saved));
});
