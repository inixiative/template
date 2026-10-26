/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import { userEntries } from '@template/permissions/roles/userEntries';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export const setupUserPermissions = async (c: Context<AppEnv>) => {
  await c
    .get('permix')
    .setup(
      userEntries(
        c.get('user')?.id ?? null,
        c.get('organizationUsers') ?? [],
        c.get('spaceUsers') ?? [],
      ),
    );
};
