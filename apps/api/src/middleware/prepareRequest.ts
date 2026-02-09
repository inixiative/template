import { db } from '@template/db';
import { createPermissions } from '@template/permissions';
import { logScope } from '@template/shared/logger';
import type { Context, Next } from 'hono';
import { isSuperadmin } from '#/lib/context/isSuperadmin';
import { setupOrgPermissions } from '#/lib/permissions/setupOrgPermissions';
import { setupSpacePermissions } from '#/lib/permissions/setupSpacePermissions';
import { setupUserPermissions } from '#/lib/permissions/setupUserPermissions';
import { parseBracketNotation } from '#/lib/utils/parseBracketNotation';
import type { AppEnv } from '#/types/appEnv';

export const prepareRequest = async (c: Context<AppEnv>, next: Next) => {
  const batchId = c.req.header('x-batch-id');
  let batchContext;
  if (batchId) {
    const { getBatchContext } = await import('#/modules/batch/services/batchRegistry');
    batchContext = getBatchContext(batchId);
  }

  const requestId = batchContext?.baseContext.get('requestId') ?? crypto.randomUUID();

  c.set('db', batchContext?.txn ?? db);
  c.set('txn', batchContext?.txn);
  c.set('requestId', requestId);
  c.set('permix', createPermissions());

  if (batchContext) {
    // App metadata is read-only, safe to reuse
    c.set('app', batchContext.baseContext.get('app'));

    // Deep clone mutable context to prevent mutation leakage between batch sub-requests
    const keysToClone = ['user', 'session', 'organizationUsers', 'organizations', 'spaceUsers', 'spaces', 'token', 'spoofedBy'] as const;
    for (const key of keysToClone) {
      const value = batchContext.baseContext.get(key);
      c.set(key, value ? structuredClone(value) : null);
    }

    const user = batchContext.baseContext.get('user');
    if (user) {
      const permix = c.get('permix');
      permix.setUserId(user.id as any);
      if (isSuperadmin(c)) permix.setSuperadmin(true);

      await setupUserPermissions(c);
      await setupOrgPermissions(c);
      await setupSpacePermissions(c);
    }
  } else {
    c.set('user', null);
    c.set('session', null);
    c.set('organizationUsers', null);
    c.set('organizations', null);
    c.set('spaceUsers', null);
    c.set('spaces', null);
    c.set('token', null);
    c.set('spoofedBy', null);
  }

  c.set('resource', null);
  c.set('resourceType', null);
  c.set('searchableFields', null);

  const bracketQuery = parseBracketNotation(c.req.url);
  c.set('bracketQuery', bracketQuery);

  c.header('request-id', requestId);

  if (batchContext) {
    await next();
  } else {
    await logScope('api', () => logScope(requestId, () => db.scope(requestId, next)));
  }
};
