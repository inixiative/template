/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import { installGrants, userGrants } from '@template/permissions/roles/userGrants';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export const contextUserGrants = (c: Context<AppEnv>, userId: string | null) =>
  userGrants(userId, c.get('organizationUsers') ?? [], c.get('spaceUsers') ?? []);

export const setupUserPermissions = async (c: Context<AppEnv>) => {
  await installGrants(c.get('permix'), contextUserGrants(c, c.get('user')?.id ?? null));
};
