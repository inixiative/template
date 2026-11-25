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
import {
  passkeyConfirmBodySchema,
  passkeyConfirmResponseSchema,
} from '#/modules/me/schemas/twoFactorSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const mePasskeyConfirmRoute = actionRoute({
  model: Modules.me,
  action: 'twoFactor/passkey/confirm',
  skipId: true,
  forbid: { tokens: true, spoof: true, batch: true },
  bodySchema: passkeyConfirmBodySchema,
  responseSchema: passkeyConfirmResponseSchema,
  middleware: [
    twoFactorRateLimit,
    validatePermission(UserAction.manageTwoFactor),
    requireRecentTwoFactorMiddleware(),
  ],
  description: 'Verifies a WebAuthn registration response and saves the new passkey.',
  tags: [OpenApiTags.me, OpenApiTags.twoFactor],
});
