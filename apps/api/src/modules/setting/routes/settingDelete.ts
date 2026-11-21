/**
 * @atlas
 * @kind route
 * @partOf feature:setting
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const settingDeleteRoute = deleteRoute({
  model: Modules.setting,
  middleware: [validatePermission('delete')],
  description:
    'Soft-deletes a stored setting row, resetting the setting to its code-defined default.',
});
