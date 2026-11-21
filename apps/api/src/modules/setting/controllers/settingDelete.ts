/**
 * @atlas
 * @kind controller
 * @partOf feature:setting
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { settingDeleteRoute } from '#/modules/setting/routes/settingDelete';

export const settingDeleteController = makeController(settingDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const setting = contextResource<'setting'>(c);
  await db.setting.update({ where: { id: setting.id }, data: { deletedAt: new Date() } });
  return respond.noContent();
});
