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
import { realUserActor } from '#/lib/context/realUserActor';
import { makeError } from '#/lib/errors';
import { fetchUserTwoFactorMethods } from '#/lib/twoFactor/fetchUserTwoFactorMethods';
import { isTwoFactorRequired } from '#/lib/twoFactor/isTwoFactorRequired';
import { rpIdFromOrigin } from '#/lib/twoFactor/passkey/resolveWebAuthnOrigin';
import type { AppEnv } from '#/types/appEnv';

const isReadOnlyTwoFactorPath = (method: string, path: string): boolean =>
  method === 'GET' && (path === '/api/v1/me' || path === '/api/v1/me/twoFactor');

const isEnrollTwoFactorPath = (method: string, path: string): boolean =>
  method === 'POST' &&
  (path === '/api/v1/me/twoFactor/totp/start' ||
    path === '/api/v1/me/twoFactor/totp/confirm' ||
    path === '/api/v1/me/twoFactor/passkey/options' ||
    path === '/api/v1/me/twoFactor/passkey/confirm');

const isVerifyTwoFactorPath = (method: string, path: string): boolean =>
  method === 'POST' &&
  (path === '/api/v1/me/twoFactor/verify' ||
    path === '/api/v1/me/twoFactor/verify/passkey/options');

export const requireTwoFactorSessionMiddleware = async (c: Context<AppEnv>, next: Next) => {
  if (c.get('token')) return next();

  const actor = realUserActor(c);
  if (!actor) return next();

  const required = isTwoFactorRequired();
  const isSpoofing = Boolean(c.get('spoofedBy'));

  if (required && !actor.twoFactorEnabled) {
    if (
      !isSpoofing &&
      (isReadOnlyTwoFactorPath(c.req.method, c.req.path) ||
        isEnrollTwoFactorPath(c.req.method, c.req.path))
    )
      return next();

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

  if (c.get('jwtTwoFactorVerified')) return next();
  if (!actor.twoFactorEnabled) return next();

  if (
    !isSpoofing &&
    (isReadOnlyTwoFactorPath(c.req.method, c.req.path) ||
      isVerifyTwoFactorPath(c.req.method, c.req.path))
  )
    return next();

  const methods = await fetchUserTwoFactorMethods(actor.id, rpIdFromOrigin(c.req.header('origin')));
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
