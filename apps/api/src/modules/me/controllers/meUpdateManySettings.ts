/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { meUpdateManySettingsRoute } from '#/modules/me/routes/meUpdateManySettings';
import { upsertResourceSettings } from '#/modules/setting/services/upsertResourceSettings';

export const meUpdateManySettingsController = makeController(
  meUpdateManySettingsRoute,
  async (c, respond) => {
    const saved = await upsertResourceSettings(c, SettingResourceModel.User, c.req.valid('json'));
    return respond.ok(saved);
  },
);
