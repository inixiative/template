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
import { twoFactorRateLimit } from '#/middleware/rateLimit/twoFactorRateLimit';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  passkeyRenameBodySchema,
  passkeyResponseSchema,
} from '#/modules/me/schemas/twoFactorSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const mePasskeyRenameRoute = actionRoute({
  model: Modules.me,
  action: 'twoFactor/passkey/rename',
  skipId: true,
  bodySchema: passkeyRenameBodySchema,
  responseSchema: passkeyResponseSchema,
  middleware: [
    forbidApiTokenMiddleware,
    forbidSpoofingMiddleware,
    twoFactorRateLimit,
    validatePermission(UserAction.manageTwoFactor),
  ],
  description: 'Renames one of your registered passkeys.',
  tags: [OpenApiTags.me, OpenApiTags.twoFactor],
  'x-batch': false,
});
