/**
 * @atlas
 * @kind route
 * @partOf feature:setting
 * @uses primitive:routeTemplates
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { settingAdminRowResponseSchema } from '#/modules/setting/schemas/settingSchemas';

export const adminSettingReadManyRoute = readRoute({
  model: Modules.setting,
  many: true,
  paginate: true,
  admin: true,
  filterLens: { parent: lensFor('Setting') },
  responseSchema: settingAdminRowResponseSchema,
});
