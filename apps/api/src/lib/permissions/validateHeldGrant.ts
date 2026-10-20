/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses primitive:errors, infrastructure:prisma
 */
import type { UserId } from '@template/db';
import { type EntitlementGrant, findUnheldGrant } from '@template/permissions';
import type { Context } from 'hono';
import { getPrincipal } from '#/lib/context/getPrincipal';
import { makeError } from '#/lib/errors';
import { type GrantedCredential, grantEntries } from '#/lib/permissions/grantEntries';
import { findUserWithRelations } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

export type IssuedCredential = GrantedCredential & { userId: string | null };

export const findUnheldIssuedGrant = async (
  c: Context<AppEnv>,
  grant: EntitlementGrant,
  credential: IssuedCredential,
): Promise<string[]> => {
  const { user } = getPrincipal(c);
  const owner =
    credential.userId && credential.userId === user?.id
      ? user
      : credential.userId && (await findUserWithRelations(credential.userId as UserId));
  if (!owner) return ['a user to hold the grant'];
  return findUnheldGrant(c.get('permix'), grantEntries(owner, credential), grant);
};

export const validateHeldGrant = async (
  c: Context<AppEnv>,
  grant: EntitlementGrant,
  credential: IssuedCredential,
): Promise<void> => {
  const unheld = await findUnheldIssuedGrant(c, grant, credential);
  if (unheld.length)
    throw makeError({
      status: 403,
      message: `Cannot grant what you do not hold: ${unheld.join(', ')}`,
    });
};
