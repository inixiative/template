/**
 * @atlas
 * @kind validator, middleware
 * @partOf superadmin
 * @uses primitive:errors, infrastructure:prisma
 */
import { db } from '@template/db';
import type { Context, Next } from 'hono';
import { isSuperadmin } from '#/lib/context/isSuperadmin';
import { makeError } from '#/lib/errors';

import type { AppEnv } from '#/types/appEnv';

export const validateSuperadmin = async (c: Context<AppEnv>, next: Next) => {
  if (!isSuperadmin(c)) {
    throw makeError({ status: 403, message: 'Superadmin access required' });
  }
  return db.withDeleted(() => next());
};
