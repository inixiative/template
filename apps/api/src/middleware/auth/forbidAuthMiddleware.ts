/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth, primitive:routeTemplates
 * @uses primitive:errors, primitive:requestContext
 */
import type { Context, MiddlewareHandler } from 'hono';
import { isBatchSubRequest } from '#/lib/context/isBatchSubRequest';
import { makeError } from '#/lib/errors';
import type { RouteForbid } from '#/lib/routeTemplates/types';
import type { AppEnv } from '#/types/appEnv';

type ForbidRule = keyof RouteForbid;

type ForbidCheck = {
  status: 400 | 403;
  message: string;
  matches: (c: Context<AppEnv>, credentialKind: 'jwt' | 'token' | null) => boolean;
};

const FORBID_CHECKS = {
  batch: {
    status: 400,
    message: 'This endpoint cannot run in a batch',
    matches: (c) => isBatchSubRequest(c),
  },
  tokens: {
    status: 403,
    message: 'API tokens cannot be used on this endpoint',
    matches: (_c, credentialKind) => credentialKind === 'token',
  },
  jwt: {
    status: 403,
    message: 'User JWT sessions cannot be used on this endpoint',
    matches: (_c, credentialKind) => credentialKind === 'jwt',
  },
  spoof: {
    status: 403,
    message: 'This endpoint cannot be used while spoofing another user',
    matches: (c) => Boolean(c.get('spoofedBy')),
  },
} satisfies Record<ForbidRule, ForbidCheck>;

const FORBID_RULES = Object.keys(FORBID_CHECKS) as readonly ForbidRule[];

export const makeForbidMiddleware =
  (forbid: RouteForbid): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const credentialKind =
      c.get('authCredentialKind') ?? (c.get('token') ? 'token' : c.get('user') ? 'jwt' : null);

    const violations = FORBID_RULES.filter(
      (rule) => forbid[rule] && FORBID_CHECKS[rule].matches(c, credentialKind),
    ).map((rule) => ({ rule, ...FORBID_CHECKS[rule] }));

    if (violations.length > 0) {
      const status = violations.some((violation) => violation.status === 403) ? 403 : 400;
      throw makeError({
        status,
        message: violations.map((violation) => violation.message).join('; '),
        details: violations.map(({ rule, message }) => ({
          code: `FORBID_${rule.toUpperCase()}`,
          rule,
          message,
        })),
      });
    }

    await next();
  };
