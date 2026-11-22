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
import { credentialChangeRateLimit } from '#/middleware/rateLimit/credentialChangeRateLimit';
import { twoFactorRateLimit } from '#/middleware/rateLimit/twoFactorRateLimit';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  enrollmentStartBodySchema,
  totpStartResponseSchema,
} from '#/modules/me/schemas/twoFactorSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meStartTotpRoute = actionRoute({
  model: Modules.me,
  action: 'twoFactor/totp/start',
  skipId: true,
  bodySchema: enrollmentStartBodySchema,
  responseSchema: totpStartResponseSchema,
  middleware: [
    forbidApiTokenMiddleware,
    forbidSpoofingMiddleware,
    credentialChangeRateLimit,
    twoFactorRateLimit,
    validatePermission(UserAction.manageTwoFactor),
    requireRecentTwoFactorMiddleware(),
  ],
  description: 'Starts authenticator app (TOTP) setup and returns a secret and otpauth URI.',
  tags: [OpenApiTags.me, OpenApiTags.twoFactor],
  'x-batch': false,
});
