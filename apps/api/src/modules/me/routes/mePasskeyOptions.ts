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
  webAuthnOptionsResponseSchema,
} from '#/modules/me/schemas/twoFactorSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const mePasskeyOptionsRoute = actionRoute({
  model: Modules.me,
  action: 'twoFactor/passkey/options',
  skipId: true,
  forbid: { tokens: true, spoof: true, batch: true },
  bodySchema: enrollmentStartBodySchema,
  responseSchema: webAuthnOptionsResponseSchema,
  middleware: [
    credentialChangeRateLimit,
    twoFactorRateLimit,
    validatePermission(UserAction.manageTwoFactor),
    requireRecentTwoFactorMiddleware(),
  ],
  description: 'Generates WebAuthn registration options for adding a new passkey.',
  tags: [OpenApiTags.me, OpenApiTags.twoFactor],
});
