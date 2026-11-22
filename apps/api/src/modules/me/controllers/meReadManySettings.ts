/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { meReadManySettingsRoute } from '#/modules/me/routes/meReadManySettings';
import { readResourceSettings } from '#/modules/setting/services/readResourceSettings';

export const meReadManySettingsController = makeController(
  meReadManySettingsRoute,
  async (c, respond) => {
    const settings = await readResourceSettings(c, SettingResourceModel.User, c.req.valid('query'));
    return respond.ok(settings);
  },
);
