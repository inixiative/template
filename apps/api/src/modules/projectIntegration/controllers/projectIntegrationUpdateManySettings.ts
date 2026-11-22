/**
 * @atlas
 * @kind controller
 * @partOf feature:project, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { projectIntegrationUpdateManySettingsRoute } from '#/modules/projectIntegration/routes/projectIntegrationUpdateManySettings';
import { upsertResourceSettings } from '#/modules/setting/services/upsertResourceSettings';

export const projectIntegrationUpdateManySettingsController = makeController(
  projectIntegrationUpdateManySettingsRoute,
  async (c, respond) => {
    const saved = await upsertResourceSettings(
      c,
      SettingResourceModel.ProjectIntegration,
      c.req.valid('json'),
    );
    return respond.ok(saved);
  },
);
