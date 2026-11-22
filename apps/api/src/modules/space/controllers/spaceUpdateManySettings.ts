/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { upsertResourceSettings } from '#/modules/setting/services/upsertResourceSettings';
import { spaceUpdateManySettingsRoute } from '#/modules/space/routes/spaceUpdateManySettings';

export const spaceUpdateManySettingsController = makeController(
  spaceUpdateManySettingsRoute,
  async (c, respond) => {
    const saved = await upsertResourceSettings(c, SettingResourceModel.Space, c.req.valid('json'));
    return respond.ok(saved);
  },
);
