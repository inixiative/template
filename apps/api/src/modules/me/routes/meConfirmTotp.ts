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
import {
  totpConfirmBodySchema,
  totpConfirmResponseSchema,
} from '#/modules/me/schemas/twoFactorSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meConfirmTotpRoute = actionRoute({
  model: Modules.me,
  action: 'twoFactor/totp/confirm',
  skipId: true,
  bodySchema: totpConfirmBodySchema,
  responseSchema: totpConfirmResponseSchema,
  middleware: [
    forbidApiTokenMiddleware,
    forbidSpoofingMiddleware,
    twoFactorRateLimit,
    validatePermission(UserAction.manageTwoFactor),
    requireRecentTwoFactorMiddleware(),
  ],
  description:
    'Confirms a pending authenticator app (TOTP) setup with a 6-digit code and enables TOTP.',
  tags: [OpenApiTags.me, OpenApiTags.twoFactor],
  'x-batch': false,
});
