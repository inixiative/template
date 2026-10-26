/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { Context } from 'hono';
import { delegateTable, ownerTable } from '#/lib/permissions/ownerTable';
import { contextUserEntries } from '#/lib/permissions/setupUserPermissions';
import type { AppEnv } from '#/types/appEnv';

export const setupTokenPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');
  if (!token) return;

  const owner =
    token.ownerModel === 'User'
      ? { entries: contextUserEntries(c, token.userId) }
      : await ownerTable(token);
  const table = await delegateTable(token, owner);
  await permix.setup(table.entries, table.owner && { owner: table.owner });
};
