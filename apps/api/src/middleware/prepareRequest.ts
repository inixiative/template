import { db } from '@template/db';
import { createPermissions } from '@template/permissions';
import { logScope } from '@template/shared/logger';
import type { Context, Next } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export const prepareRequest = async (c: Context<AppEnv>, next: Next) => {
  const requestId = crypto.randomUUID();
  c.set('db', db);
  c.set('requestId', requestId);
  c.set('permix', createPermissions());
  c.set('user', null);
  c.set('session', null);
  c.set('token', null);
  c.set('spoofedBy', null);
  c.set('resource', null);
  c.set('resourceType', null);
  c.header('request-id', requestId);
  await logScope('api', () => logScope(requestId, () => db.scope(requestId, next)));
};
