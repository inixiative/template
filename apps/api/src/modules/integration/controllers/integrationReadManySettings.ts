/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { integrationReadManySettingsRoute } from '#/modules/integration/routes/integrationReadManySettings';
import { readResourceSettings } from '#/modules/setting/services/readResourceSettings';

export const integrationReadManySettingsController = makeController(
  integrationReadManySettingsRoute,
  async (c, respond) => {
    const settings = await readResourceSettings(
      c,
      SettingResourceModel.Integration,
      c.req.valid('query'),
    );
    return respond.ok(settings);
  },
);
