/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { UserAction } from '@template/permissions/client';
import { actionRoute } from '#/lib/routeTemplates';
import { forbidApiTokenMiddleware } from '#/middleware/auth/forbidApiTokenMiddleware';
import { forbidSpoofingMiddleware } from '#/middleware/auth/forbidSpoofingMiddleware';
import { requireRecentTwoFactorMiddleware } from '#/middleware/auth/requireRecentTwoFactorMiddleware';
import { twoFactorRateLimit } from '#/middleware/rateLimit/twoFactorRateLimit';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { passkeyDeleteBodySchema } from '#/modules/me/schemas/twoFactorSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const mePasskeyDeleteRoute = actionRoute({
  model: Modules.me,
  action: 'twoFactor/passkey/delete',
  skipId: true,
  bodySchema: passkeyDeleteBodySchema,
  middleware: [
    forbidApiTokenMiddleware,
    forbidSpoofingMiddleware,
    twoFactorRateLimit,
    validatePermission(UserAction.manageTwoFactor),
    requireRecentTwoFactorMiddleware(),
  ],
  description: 'Removes one of your registered passkeys (requires recent 2FA verification).',
  tags: [OpenApiTags.me, OpenApiTags.twoFactor],
  'x-batch': false,
});
