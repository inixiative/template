/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { readResourceSettings } from '#/modules/setting/services/readResourceSettings';
import { spaceReadManySettingsRoute } from '#/modules/space/routes/spaceReadManySettings';

export const spaceReadManySettingsController = makeController(
  spaceReadManySettingsRoute,
  async (c, respond) => {
    const settings = await readResourceSettings(
      c,
      SettingResourceModel.Space,
      c.req.valid('query'),
    );
    return respond.ok(settings);
  },
);
