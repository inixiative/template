/**
 * @atlas
 * @kind controller
 * @partOf feature:project, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { projectIntegrationReadManySettingsRoute } from '#/modules/projectIntegration/routes/projectIntegrationReadManySettings';
import { readResourceSettings } from '#/modules/setting/services/readResourceSettings';

export const projectIntegrationReadManySettingsController = makeController(
  projectIntegrationReadManySettingsRoute,
  async (c, respond) => {
    const settings = await readResourceSettings(
      c,
      SettingResourceModel.ProjectIntegration,
      c.req.valid('query'),
    );
    return respond.ok(settings);
  },
);
