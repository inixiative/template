/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses primitive:authz
 */
import type { Context } from 'hono';
import { actingUser } from '#/lib/context/actingUser';
import { installPermissionsFor } from '#/lib/permissions/userPermissions';
import type { AppEnv } from '#/types/appEnv';

export const installPermissionsFromRequestContext = (c: Context<AppEnv>) =>
  installPermissionsFor(c.get('permix'), {
    user: actingUser(c),
    token: c.get('token'),
    organizationUsers: c.get('organizationUsers') ?? [],
    spaceUsers: c.get('spaceUsers') ?? [],
  });
