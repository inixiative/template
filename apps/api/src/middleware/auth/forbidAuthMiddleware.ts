/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth, primitive:routeTemplates
 * @uses primitive:errors, primitive:requestContext
 */
import type { MiddlewareHandler } from 'hono';
import { isBatchSubRequest } from '#/lib/context/isBatchSubRequest';
import { makeError } from '#/lib/errors';
import type { RouteForbid } from '#/lib/routeTemplates/types';
import type { AppEnv } from '#/types/appEnv';

export const makeForbidMiddleware =
  (forbid: RouteForbid): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    if (forbid.batch && isBatchSubRequest(c)) {
      throw makeError({
        status: 400,
        message: 'This endpoint cannot run in a batch',
      });
    }
    const credentialKind =
      c.get('authCredentialKind') ?? (c.get('token') ? 'token' : c.get('user') ? 'jwt' : null);

    if (forbid.tokens && credentialKind === 'token') {
      throw makeError({
        status: 403,
        message: 'API tokens cannot be used on this endpoint',
      });
    }
    if (forbid.jwt && credentialKind === 'jwt') {
      throw makeError({
        status: 403,
        message: 'User JWT sessions cannot be used on this endpoint',
      });
    }
    if (forbid.spoof && c.get('spoofedBy')) {
      throw makeError({
        status: 403,
        message: 'This endpoint cannot be used while spoofing another user',
      });
    }
    await next();
  };
