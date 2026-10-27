/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses primitive:authz
 */
import type { Context } from 'hono';
import { me } from '#/lib/context/me';
import { installPermissionsFor } from '#/lib/permissions/userPermissions';
import type { AppEnv } from '#/types/appEnv';

export const installPermissions = (c: Context<AppEnv>) =>
  installPermissionsFor(c.get('permix'), {
    user: me(c),
    token: c.get('token'),
    organizationUsers: c.get('organizationUsers') ?? [],
    spaceUsers: c.get('spaceUsers') ?? [],
  });
