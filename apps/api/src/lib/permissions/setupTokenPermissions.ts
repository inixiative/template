/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { Context } from 'hono';
import { delegateTable, ownerTable } from '#/lib/permissions/ownerTable';
import type { AppEnv } from '#/types/appEnv';

export const setupTokenPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');
  if (!token) return;

  const table = await delegateTable(token, await ownerTable(token));
  await permix.setup(table.entries, table.owner && { owner: table.owner });
};
