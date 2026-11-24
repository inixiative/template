/**
 * @atlas
 * @kind middleware
 * @partOf primitive:authz
 * @uses primitive:batch
 */
import { db } from '@template/db';
import { createPermissions } from '@template/permissions';
import { withLogContext, withLogScope } from '@template/shared/logger';
import type { Context, Next } from 'hono';
import { installPermissionsFromRequestContext } from '#/lib/context/installPermissionsFromRequestContext';
import { parseBracketNotation } from '#/lib/utils/parseBracketNotation';
import type { batchContextById as getBatchContextFn } from '#/modules/batch/services/batchRegistry';
import type { AppEnv } from '#/types/appEnv';

export const prepareRequestMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const batchId = c.req.header('x-batch-id');
  let batchContext: ReturnType<typeof getBatchContextFn>;
  if (batchId) {
    const { batchContextById } = await import('#/modules/batch/services/batchRegistry');
    batchContext = batchContextById(batchId);
  }

  const requestId = batchContext?.baseContext.get('requestId') ?? Bun.randomUUIDv7();

  c.set('db', db);
  c.set('txn', batchContext ? db : undefined);
  c.set('requestId', requestId);
  c.set('permix', createPermissions());

  if (batchContext) {
    // App metadata is read-only, safe to reuse
    c.set('app', batchContext.baseContext.get('app'));

    // Deep clone mutable context to prevent mutation leakage between batch sub-requests
    const keysToClone = [
      'user',
      'organizationUsers',
      'organizations',
      'spaceUsers',
      'spaces',
      'token',
      'spoofedBy',
    ] as const;
    for (const key of keysToClone) {
      const value = batchContext.baseContext.get(key);
      c.set(key, value ? structuredClone(value) : null);
    }

    c.set('authCredentialKind', batchContext.baseContext.get('authCredentialKind'));
    c.set('jwtIsPlatformIssued', batchContext.baseContext.get('jwtIsPlatformIssued'));
    c.set('jwtTwoFactorVerified', batchContext.baseContext.get('jwtTwoFactorVerified'));
    c.set('jwtTwoFactorVerifiedAt', batchContext.baseContext.get('jwtTwoFactorVerifiedAt'));
    if (c.get('user') || c.get('token')) await installPermissionsFromRequestContext(c);
  } else {
    c.set('user', null);
    c.set('organizationUsers', null);
    c.set('organizations', null);
    c.set('spaceUsers', null);
    c.set('spaces', null);
    c.set('token', null);
    c.set('spoofedBy', null);
    c.set('authCredentialKind', null);
    c.set('jwtIsPlatformIssued', false);
    c.set('jwtTwoFactorVerified', false);
    c.set('jwtTwoFactorVerifiedAt', null);
  }

  c.set('resource', null);
  c.set('resourceType', null);
  c.set('filterLens', null);

  const bracketQuery = parseBracketNotation(c.req.url);
  c.set('bracketQuery', bracketQuery);

  c.header('request-id', requestId);

  if (batchContext) {
    await next();
  } else {
    await withLogContext({ requestId }, () =>
      withLogScope('api', () => withLogScope(requestId, () => db.scope(requestId, next, 'api'))),
    );
  }
};
