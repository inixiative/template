/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { UserAction } from '@template/permissions/client';
import { actionRoute } from '#/lib/routeTemplates';
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
  forbid: { tokens: true, spoof: true, batch: true },
  bodySchema: passkeyDeleteBodySchema,
  middleware: [
    twoFactorRateLimit,
    validatePermission(UserAction.manageTwoFactor),
    requireRecentTwoFactorMiddleware(),
  ],
  description: 'Removes one of your registered passkeys (requires recent 2FA verification).',
  tags: [OpenApiTags.me, OpenApiTags.twoFactor],
});
