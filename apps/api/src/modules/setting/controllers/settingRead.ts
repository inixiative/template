/**
 * @atlas
 * @kind controller
 * @partOf feature:setting
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { settingReadRoute } from '#/modules/setting/routes/settingRead';
import { formatSettingRow } from '#/modules/setting/schemas/settingSchemas';

export const settingReadController = makeController(settingReadRoute, async (c, respond) => {
  const setting = contextResource<'setting'>(c);
  return respond.ok(formatSettingRow(setting));
});
