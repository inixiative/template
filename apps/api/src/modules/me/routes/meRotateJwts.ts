/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */

import { UserAction } from '@template/permissions/client';
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meRotateJwtsRoute = actionRoute({
  model: Modules.me,
  action: 'rotateJwts',
  skipId: true,
  middleware: [validatePermission(UserAction.rotateUserJwts)],
  description:
    'Rotates your JWT version: every JWT this API has signed for you, on every device, stops working. ' +
    'Sign in again afterwards. Signing out of one browser needs no call; that browser drops its JWT.',
  tags: [Tags.me, Tags.user],
});
