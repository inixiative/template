/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { SessionAction } from '@template/permissions/client';
import { actionRoute } from '#/lib/routeTemplates';
import { authRateLimit } from '#/middleware/rateLimit/authRateLimit';
import { credentialChangeRateLimit } from '#/middleware/rateLimit/credentialChangeRateLimit';
import { validateNotSpoofed } from '#/middleware/validations/validateNotSpoofed';
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';
import {
  changePasswordBodySchema,
  changePasswordResponseSchema,
} from '#/modules/me/schemas/changePasswordSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meChangePasswordRoute = actionRoute({
  model: Modules.me,
  action: 'changePassword',
  skipId: true,
  bodySchema: changePasswordBodySchema,
  responseSchema: changePasswordResponseSchema,
  middleware: [
    authRateLimit,
    credentialChangeRateLimit,
    validateNotSpoofed,
    validateSelfPermission(SessionAction.changePassword),
  ],
  description:
    'Changes your password after checking the current one. Every JWT signed for you before stops working; ' +
    'the response carries your new JWT.',
  tags: [Tags.me, Tags.user],
});
