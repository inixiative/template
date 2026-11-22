/**
 * @atlas
 * @kind controller
 * @partOf feature:setting
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { settingReadRoute } from '#/modules/setting/routes/settingRead';

export const settingReadController = makeController(settingReadRoute, async (c, respond) => {
  const setting = contextResource<'setting'>(c);
  return respond.ok(setting);
});
