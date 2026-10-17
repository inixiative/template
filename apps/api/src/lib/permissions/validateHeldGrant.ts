/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses primitive:errors
 */
import type { EntitlementGrant } from '@template/permissions';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import { findUnheldGrant } from '#/lib/permissions/findUnheldGrant';
import type { AppEnv } from '#/types/appEnv';

export const validateHeldGrant = async (
  c: Context<AppEnv>,
  grant: EntitlementGrant,
): Promise<void> => {
  const unheld = await findUnheldGrant(c, grant);
  if (unheld.length)
    throw makeError({
      status: 403,
      message: `Cannot grant what you do not hold: ${unheld.join(', ')}`,
    });
};
