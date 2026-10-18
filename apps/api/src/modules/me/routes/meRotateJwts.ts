/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { actionRoute } from '#/lib/routeTemplates';
import { validateNotToken } from '#/middleware/validations/validateNotToken';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meRotateJwtsRoute = actionRoute({
  model: Modules.me,
  action: 'rotateJwts',
  skipId: true,
  middleware: [validateNotToken],
  description:
    'Rotates your JWT version: every JWT this API has signed for you, on every device, stops working. ' +
    'Sign in again afterwards. Signing out of one browser needs no call; that browser drops its JWT.',
  tags: [Tags.me, Tags.user],
});
