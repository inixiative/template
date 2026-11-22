/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { integrationUpdateManySettingsRoute } from '#/modules/integration/routes/integrationUpdateManySettings';
import { upsertResourceSettings } from '#/modules/setting/services/upsertResourceSettings';

export const integrationUpdateManySettingsController = makeController(
  integrationUpdateManySettingsRoute,
  async (c, respond) => {
    const saved = await upsertResourceSettings(
      c,
      SettingResourceModel.Integration,
      c.req.valid('json'),
    );
    return respond.ok(saved);
  },
);
