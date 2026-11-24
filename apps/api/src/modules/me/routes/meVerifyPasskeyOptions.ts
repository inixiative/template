/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { UserAction } from '@template/permissions/client';
import { actionRoute } from '#/lib/routeTemplates';
import { twoFactorRateLimit } from '#/middleware/rateLimit/twoFactorRateLimit';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { webAuthnOptionsResponseSchema } from '#/modules/me/schemas/twoFactorSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meVerifyPasskeyOptionsRoute = actionRoute({
  model: Modules.me,
  action: 'twoFactor/verify/passkey/options',
  skipId: true,
  forbid: { tokens: true, batch: true },
  responseSchema: webAuthnOptionsResponseSchema,
  middleware: [twoFactorRateLimit, validatePermission(UserAction.manageTwoFactor)],
  description: 'Generates WebAuthn authentication options for two-factor verification.',
  tags: [OpenApiTags.me, OpenApiTags.twoFactor],
});
