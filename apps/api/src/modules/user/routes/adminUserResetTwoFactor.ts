/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth, superadmin
 * @uses primitive:routeTemplates
 */
import { actionRoute } from '#/lib/routeTemplates';
import { forbidApiTokenMiddleware } from '#/middleware/auth/forbidApiTokenMiddleware';
import { requireRecentTwoFactorMiddleware } from '#/middleware/auth/requireRecentTwoFactorMiddleware';
import { twoFactorRateLimit } from '#/middleware/rateLimit/twoFactorRateLimit';
import { Modules } from '#/modules/modules';

export const adminUserResetTwoFactorRoute = actionRoute({
  model: Modules.user,
  action: 'resetTwoFactor',
  admin: true,
  middleware: [forbidApiTokenMiddleware, twoFactorRateLimit, requireRecentTwoFactorMiddleware()],
  description:
    "Resets the user's two-factor authentication (clears TOTP, backup codes, and passkeys) and revokes all active JWTs.",
  'x-batch': false,
});
