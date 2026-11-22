/**
 * @atlas
 * @kind controller
 * @partOf feature:setting
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminSettingReadManyRoute } from '#/modules/setting/routes/adminSettingReadMany';

export const adminSettingReadManyController = makeController(
  adminSettingReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.setting);
    return respond.ok(data, { pagination });
  },
);
