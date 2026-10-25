/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import type { Context } from 'hono';
import { userEntries } from '#/lib/permissions/ownerTable';
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
