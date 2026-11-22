/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { UserAction } from '@template/permissions/client';
import { actionRoute } from '#/lib/routeTemplates';
import { forbidApiTokenMiddleware } from '#/middleware/auth/forbidApiTokenMiddleware';
import { twoFactorRateLimit } from '#/middleware/rateLimit/twoFactorRateLimit';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  verifyFactorBodyRefinement,
  verifyFactorBodySchema,
  verifyTwoFactorResponseSchema,
} from '#/modules/me/schemas/twoFactorSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meVerifyTwoFactorRoute = actionRoute({
  model: Modules.me,
  action: 'twoFactor/verify',
  skipId: true,
  bodySchema: verifyFactorBodySchema,
  bodyRefinement: verifyFactorBodyRefinement,
  responseSchema: verifyTwoFactorResponseSchema,
  middleware: [
    forbidApiTokenMiddleware,
    twoFactorRateLimit,
    validatePermission(UserAction.manageTwoFactor),
  ],
  description:
    'Verifies TOTP, passkey, or backup code and issues an upgraded JWT with a fresh 5-minute 2FA verification window.',
  tags: [OpenApiTags.me, OpenApiTags.twoFactor],
  'x-batch': false,
});
