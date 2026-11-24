/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses primitive:errors
 */
import {
  TWO_FACTOR_ENROLLMENT_REQUIRED_CODE,
  TWO_FACTOR_VERIFICATION_REQUIRED_CODE,
} from '@template/shared/auth/twoFactor';
import type { Context, Next } from 'hono';
import { isBatchSubRequest } from '#/lib/context/isBatchSubRequest';
import { makeError } from '#/lib/errors';
import { makeRouteMatcher } from '#/lib/http/routeMatcher';
import { fetchUserTwoFactorMethods } from '#/lib/twoFactor/fetchUserTwoFactorMethods';
import { isTwoFactorRequired } from '#/lib/twoFactor/isTwoFactorRequired';
import { rpIdFromOrigin } from '#/lib/twoFactor/passkey/resolveWebAuthnOrigin';
import type { AppEnv } from '#/types/appEnv';

const isEnrollmentAllowedRoute = makeRouteMatcher([
  'GET /api/v1/me',
  'GET /api/v1/me/twoFactor',
  'POST /api/v1/me/twoFactor/totp/start',
  'POST /api/v1/me/twoFactor/totp/confirm',
  'POST /api/v1/me/twoFactor/passkey/options',
  'POST /api/v1/me/twoFactor/passkey/confirm',
]);

const isVerificationAllowedRoute = makeRouteMatcher([
  'GET /api/v1/me',
  'GET /api/v1/me/twoFactor',
  'POST /api/v1/me/twoFactor/verify',
  'POST /api/v1/me/twoFactor/verify/passkey/options',
]);

export const requireTwoFactorSessionMiddleware = async (c: Context<AppEnv>, next: Next) => {
  // why: batch sub-requests inherit the parent request's already-gated session and post-spoof context
  if (isBatchSubRequest(c) || c.get('token') || c.get('authCredentialKind') === 'token') {
    return next();
  }

  const user = c.get('user');
  if (!user) return next();

  if (isTwoFactorRequired() && !user.twoFactorEnabled) {
    if (isEnrollmentAllowedRoute(c.req.method, c.req.path)) return next();

    throw makeError({
      status: 403,
      message: 'Two-factor authentication setup is required before using this API',
      details: [
        {
          code: TWO_FACTOR_ENROLLMENT_REQUIRED_CODE,
          methods: [],
          actions: {
            startTotp: 'POST /api/v1/me/twoFactor/totp/start',
            confirmTotp: 'POST /api/v1/me/twoFactor/totp/confirm',
            passkeyOptions: 'POST /api/v1/me/twoFactor/passkey/options',
            confirmPasskey: 'POST /api/v1/me/twoFactor/passkey/confirm',
          },
        },
      ],
    });
  }

  if (c.get('jwtTwoFactorVerified') || !user.twoFactorEnabled) return next();
  if (isVerificationAllowedRoute(c.req.method, c.req.path)) return next();

  const methods = await fetchUserTwoFactorMethods(user.id, rpIdFromOrigin(c.req.header('origin')));
  throw makeError({
    status: 403,
    message: 'Two-factor verification is required for this session',
    details: [
      {
        code: TWO_FACTOR_VERIFICATION_REQUIRED_CODE,
        methods,
        actions: {
          verify: 'POST /api/v1/me/twoFactor/verify',
          passkeyOptions: 'POST /api/v1/me/twoFactor/verify/passkey/options',
        },
      },
    ],
  });
};
