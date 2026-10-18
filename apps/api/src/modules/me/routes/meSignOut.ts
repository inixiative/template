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

export const meSignOutRoute = actionRoute({
  model: Modules.me,
  action: 'signOut',
  skipId: true,
  middleware: [validateNotToken],
  description:
    'Signs you out everywhere: every JWT issued to you until now stops working. Signing out of one ' +
    'browser needs no call; that browser drops its JWT.',
  tags: [Tags.me, Tags.user],
});
