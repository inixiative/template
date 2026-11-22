/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { upsertResourceSettings } from '#/modules/setting/services/upsertResourceSettings';
import { spaceUserUpdateManySettingsRoute } from '#/modules/spaceUser/routes/spaceUserUpdateManySettings';

export const spaceUserUpdateManySettingsController = makeController(
  spaceUserUpdateManySettingsRoute,
  async (c, respond) => {
    const saved = await upsertResourceSettings(
      c,
      SettingResourceModel.SpaceUser,
      c.req.valid('json'),
    );
    return respond.ok(saved);
  },
);
