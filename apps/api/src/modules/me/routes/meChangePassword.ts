/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { UserAction } from '@template/permissions/client';
import { actionRoute } from '#/lib/routeTemplates';
import { forbidApiTokenMiddleware } from '#/middleware/auth/forbidApiTokenMiddleware';
import { requireRecentTwoFactorMiddleware } from '#/middleware/auth/requireRecentTwoFactorMiddleware';
import { authRateLimit } from '#/middleware/rateLimit/authRateLimit';
import { credentialChangeRateLimit } from '#/middleware/rateLimit/credentialChangeRateLimit';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  changePasswordBodySchema,
  changePasswordResponseSchema,
} from '#/modules/me/schemas/changePasswordSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meChangePasswordRoute = actionRoute({
  model: Modules.me,
  action: 'changePassword',
  skipId: true,
  bodySchema: changePasswordBodySchema,
  responseSchema: changePasswordResponseSchema,
  middleware: [
    forbidApiTokenMiddleware,
    authRateLimit,
    validatePermission(UserAction.changePassword),
    credentialChangeRateLimit,
    requireRecentTwoFactorMiddleware(),
  ],
  description:
    'Changes your password after checking the current one. Every JWT signed for you before stops working; ' +
    'the response carries your new JWT, or nulls when a superadmin is spoofing you.',
  tags: [OpenApiTags.me, OpenApiTags.user],
  'x-batch': false,
});
