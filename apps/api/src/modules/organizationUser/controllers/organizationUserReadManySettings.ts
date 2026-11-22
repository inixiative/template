/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { organizationUserReadManySettingsRoute } from '#/modules/organizationUser/routes/organizationUserReadManySettings';
import { readResourceSettings } from '#/modules/setting/services/readResourceSettings';

export const organizationUserReadManySettingsController = makeController(
  organizationUserReadManySettingsRoute,
  async (c, respond) => {
    const settings = await readResourceSettings(
      c,
      SettingResourceModel.OrganizationUser,
      c.req.valid('query'),
    );
    return respond.ok(settings);
  },
);
