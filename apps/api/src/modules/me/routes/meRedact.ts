/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates
 */
import { UserAction } from '@template/permissions/client';
import { actionRoute } from '#/lib/routeTemplates';
import { requireRecentTwoFactorMiddleware } from '#/middleware/auth/requireRecentTwoFactorMiddleware';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meRedactRoute = actionRoute({
  model: Modules.me,
  forbid: { tokens: true, batch: true },
  middleware: [validatePermission(UserAction.redactUser), requireRecentTwoFactorMiddleware()],
  action: 'redact',
  skipId: true,
  description: 'Permanently redacts your account data (GDPR right to be forgotten)',
  tags: [OpenApiTags.me, OpenApiTags.user],
});
