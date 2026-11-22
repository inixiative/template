/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManySettingsRoute } from '#/modules/organization/routes/organizationReadManySettings';
import { readResourceSettings } from '#/modules/setting/services/readResourceSettings';

export const organizationReadManySettingsController = makeController(
  organizationReadManySettingsRoute,
  async (c, respond) => {
    const settings = await readResourceSettings(
      c,
      SettingResourceModel.Organization,
      c.req.valid('query'),
    );
    return respond.ok(settings);
  },
);
