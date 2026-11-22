/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { organizationUpdateManySettingsRoute } from '#/modules/organization/routes/organizationUpdateManySettings';
import { upsertResourceSettings } from '#/modules/setting/services/upsertResourceSettings';

export const organizationUpdateManySettingsController = makeController(
  organizationUpdateManySettingsRoute,
  async (c, respond) => {
    const saved = await upsertResourceSettings(
      c,
      SettingResourceModel.Organization,
      c.req.valid('json'),
    );
    return respond.ok(saved);
  },
);
