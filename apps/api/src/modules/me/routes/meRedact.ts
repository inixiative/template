/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates
 */
import { UserAction } from '@template/permissions/client';
import { actionRoute } from '#/lib/routeTemplates';
import { forbidApiTokenMiddleware } from '#/middleware/auth/forbidApiTokenMiddleware';
import { requireRecentTwoFactorMiddleware } from '#/middleware/auth/requireRecentTwoFactorMiddleware';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meRedactRoute = actionRoute({
  model: Modules.me,
  middleware: [
    forbidApiTokenMiddleware,
    validatePermission(UserAction.redactUser),
    requireRecentTwoFactorMiddleware(),
  ],
  action: 'redact',
  skipId: true,
  description: 'Permanently redacts your account data (GDPR right to be forgotten)',
  tags: [OpenApiTags.me, OpenApiTags.user],
  'x-batch': false,
});
