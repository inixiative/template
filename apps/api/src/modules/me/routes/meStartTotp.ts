/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { UserAction } from '@template/permissions/client';
import { actionRoute } from '#/lib/routeTemplates';
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
  forbid: { tokens: true, spoof: true, batch: true },
  bodySchema: enrollmentStartBodySchema,
  responseSchema: totpStartResponseSchema,
  middleware: [
    credentialChangeRateLimit,
    twoFactorRateLimit,
    validatePermission(UserAction.manageTwoFactor),
    requireRecentTwoFactorMiddleware(),
  ],
  description: 'Starts authenticator app (TOTP) setup and returns a secret and otpauth URI.',
  tags: [OpenApiTags.me, OpenApiTags.twoFactor],
});
