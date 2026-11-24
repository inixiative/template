/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth, superadmin
 * @uses primitive:routeTemplates
 */
import { actionRoute } from '#/lib/routeTemplates';
import { requireRecentTwoFactorMiddleware } from '#/middleware/auth/requireRecentTwoFactorMiddleware';
import { twoFactorRateLimit } from '#/middleware/rateLimit/twoFactorRateLimit';
import { Modules } from '#/modules/modules';

export const adminUserResetTwoFactorRoute = actionRoute({
  model: Modules.user,
  action: 'resetTwoFactor',
  admin: true,
  forbid: { tokens: true, batch: true },
  middleware: [twoFactorRateLimit, requireRecentTwoFactorMiddleware()],
  description:
    "Resets the user's two-factor authentication (clears TOTP, backup codes, and passkeys) and revokes all active JWTs.",
});
