/**
 * @atlas
 * @kind controller
 * @partOf feature:project, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { projectUpdateManySettingsRoute } from '#/modules/project/routes/projectUpdateManySettings';
import { upsertResourceSettings } from '#/modules/setting/services/upsertResourceSettings';

export const projectUpdateManySettingsController = makeController(
  projectUpdateManySettingsRoute,
  async (c, respond) => {
    const saved = await upsertResourceSettings(
      c,
      SettingResourceModel.Project,
      c.req.valid('json'),
    );
    return respond.ok(saved);
  },
);
