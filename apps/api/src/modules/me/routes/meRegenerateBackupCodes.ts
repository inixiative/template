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
import { backupCodesResponseSchema } from '#/modules/me/schemas/twoFactorSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meRegenerateBackupCodesRoute = actionRoute({
  model: Modules.me,
  action: 'twoFactor/backupCodes/regenerate',
  skipId: true,
  forbid: { tokens: true, spoof: true, batch: true },
  responseSchema: backupCodesResponseSchema,
  middleware: [
    twoFactorRateLimit,
    validatePermission(UserAction.manageTwoFactor),
    requireRecentTwoFactorMiddleware(),
  ],
  description: 'Replaces all existing backup codes with a fresh set of single-use codes.',
  tags: [OpenApiTags.me, OpenApiTags.twoFactor],
});
