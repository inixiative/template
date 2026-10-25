/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { delegateClaimEntries, UserAction } from '@template/permissions';
import type { Context } from 'hono';
import {
  type DelegateHolder,
  delegateClaimOf,
  delegateHolder,
  holderPermix,
  personEntries,
} from '#/lib/permissions/delegateHolder';
import type { AppEnv } from '#/types/appEnv';

const knowsWhoItIs = ['OrganizationUser', 'SpaceUser'];

export const setupTokenPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');
  if (!token) return;

  const holder: DelegateHolder = c.get('spoofedBy')
    ? {
        entries: personEntries(
          c.get('user')?.id ?? null,
          c.get('organizationUsers') ?? [],
          c.get('spaceUsers') ?? [],
        ),
      }
    : await delegateHolder(token);
  await permix.setup(delegateClaimEntries(delegateClaimOf(token), holder.entries), {
    owner: await holderPermix(holder),
  });

  if (knowsWhoItIs.includes(token.ownerModel) && token.userId)
    await permix.setup({
      resource: 'db:user',
      id: token.userId,
      actions: { [UserAction.identify]: true },
    });
};
