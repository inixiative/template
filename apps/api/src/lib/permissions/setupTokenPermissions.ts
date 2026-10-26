/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { installGrants } from '@template/permissions/roles/userGrants';
import type { Context } from 'hono';
import { delegateTable, ownerTable } from '#/lib/permissions/ownerTable';
import { contextUserGrants } from '#/lib/permissions/setupUserPermissions';
import type { AppEnv } from '#/types/appEnv';

export const setupTokenPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');
  if (!token) return;

  const owner =
    token.ownerModel === 'User' ? contextUserGrants(c, token.userId) : await ownerTable(token);
  await installGrants(permix, delegateTable(token, owner));
};
