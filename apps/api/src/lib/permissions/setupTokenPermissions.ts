/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { delegateClaimEntries } from '@template/permissions';
import type { Context } from 'hono';
import { delegateClaimOf, delegateHolder, holderPermix } from '#/lib/permissions/delegateHolder';
import type { AppEnv } from '#/types/appEnv';

export const setupTokenPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');
  if (!token) return;

  const holder = await delegateHolder(token);
  await permix.setup(delegateClaimEntries(delegateClaimOf(token), holder.entries), {
    owner: await holderPermix(holder),
  });
};
