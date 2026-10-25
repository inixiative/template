/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import type { PermissionEntry } from '@template/permissions';
import type { Context } from 'hono';
import { personEntries } from '#/lib/permissions/delegateHolder';
import type { AppEnv } from '#/types/appEnv';

export const requestPersonEntries = (c: Context<AppEnv>): PermissionEntry[] =>
  personEntries(
    c.get('user')?.id ?? null,
    c.get('organizationUsers') ?? [],
    c.get('spaceUsers') ?? [],
  );

export const setupPersonPermissions = async (c: Context<AppEnv>) => {
  await c.get('permix').setup(requestPersonEntries(c));
};
