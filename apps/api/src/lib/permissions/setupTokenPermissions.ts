/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { delegateEntries } from '@template/permissions';
import type { Context } from 'hono';
import { delegatePermissionsOf, ownerPermix, ownerTable } from '#/lib/permissions/ownerTable';
import type { AppEnv } from '#/types/appEnv';

export const setupTokenPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');
  if (!token) return;

  const table = await ownerTable(token);
  await permix.setup(delegateEntries(delegatePermissionsOf(token), table.entries), {
    owner: await ownerPermix(table),
  });
};
