/**
 * @atlas
 * @kind controller
 * @partOf feature:project, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { projectReadManySettingsRoute } from '#/modules/project/routes/projectReadManySettings';
import { readResourceSettings } from '#/modules/setting/services/readResourceSettings';

export const projectReadManySettingsController = makeController(
  projectReadManySettingsRoute,
  async (c, respond) => {
    const settings = await readResourceSettings(
      c,
      SettingResourceModel.Project,
      c.req.valid('query'),
    );
    return respond.ok(settings);
  },
);
