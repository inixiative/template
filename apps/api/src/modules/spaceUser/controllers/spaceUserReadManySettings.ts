/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { readResourceSettings } from '#/modules/setting/services/readResourceSettings';
import { spaceUserReadManySettingsRoute } from '#/modules/spaceUser/routes/spaceUserReadManySettings';

export const spaceUserReadManySettingsController = makeController(
  spaceUserReadManySettingsRoute,
  async (c, respond) => {
    const settings = await readResourceSettings(
      c,
      SettingResourceModel.SpaceUser,
      c.req.valid('query'),
    );
    return respond.ok(settings);
  },
);
