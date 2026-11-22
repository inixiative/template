/**
 * @atlas
 * @kind route
 * @partOf feature:setting, superadmin
 * @uses primitive:routeTemplates
 */
import { SettingScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const adminSettingReadManyRoute = readRoute({
  model: Modules.setting,
  many: true,
  paginate: true,
  skipId: true,
  admin: true,
  filterLens: { parent: lensFor('Setting') },
  responseSchema: SettingScalarSchema,
});
