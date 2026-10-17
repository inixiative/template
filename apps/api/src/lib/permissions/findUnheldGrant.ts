/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz, primitive:requestContext
 * @uses infrastructure:prisma
 */
import { type HydratedRecord, hydrate } from '@template/db';
import { lesserRole, roleToStandardAction, type Slice } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { findUnheldActions } from '#/lib/permissions/findUnheldActions';
import { userHeldOn } from '#/lib/permissions/userHeldOn';
import { validateRole } from '#/lib/permissions/validateRole';
import type { AppEnv } from '#/types/appEnv';

const findUnheldRole = async (c: Context<AppEnv>, grant: Slice): Promise<string[]> => {
  const user = c.get('user');
  if (!user) return ['user'];
  const permix = c.get('permix');
  const unheld: string[] = [];
  const require = (
    model: 'user' | 'organization' | 'space',
    record: HydratedRecord,
    action: string,
  ) => {
    if (!check(permix, rebacSchema, model, record, action))
      unheld.push(`${model}:${record.id}:${action}`);
  };

  require('user', user as HydratedRecord, roleToStandardAction(grant.role));
  for (const organizationUser of c.get('organizationUsers') ?? []) {
    const role = lesserRole(validateRole(organizationUser.role), grant.role);
    require('organization', { id: organizationUser.organizationId }, roleToStandardAction(role));
  }
  for (const spaceUser of c.get('spaceUsers') ?? []) {
    const role = lesserRole(validateRole(spaceUser.role), grant.role);
    const space = await hydrate('space', { id: spaceUser.spaceId } as HydratedRecord);
    require('space', space, roleToStandardAction(role));
  }
  return unheld;
};

export const findUnheldGrant = async (c: Context<AppEnv>, grant: Slice): Promise<string[]> => [
  ...(grant.entitlementsOnly ? [] : await findUnheldRole(c, grant)),
  ...findUnheldActions(c.get('permix'), await userHeldOn(c), grant.entitlements),
];
