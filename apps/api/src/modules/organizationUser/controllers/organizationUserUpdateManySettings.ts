/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, feature:setting
 * @uses feature:setting
 */
import { SettingResourceModel } from '@template/db/generated/client/enums';
import { makeController } from '#/lib/utils/makeController';
import { organizationUserUpdateManySettingsRoute } from '#/modules/organizationUser/routes/organizationUserUpdateManySettings';
import { upsertResourceSettings } from '#/modules/setting/services/upsertResourceSettings';

export const organizationUserUpdateManySettingsController = makeController(
  organizationUserUpdateManySettingsRoute,
  async (c, respond) => {
    const saved = await upsertResourceSettings(
      c,
      SettingResourceModel.OrganizationUser,
      c.req.valid('json'),
    );
    return respond.ok(saved);
  },
);
