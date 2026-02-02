import type { OrganizationId } from '@template/db';
import type { OrganizationUser } from '@template/db/generated/client/client';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export function getOrgUser(
  c: Context<AppEnv>,
  orgId: OrganizationId,
): OrganizationUser | null {
  const orgUsers = c.get('organizationUsers');
  return orgUsers?.find((ou) => ou.organizationId === orgId) ?? null;
}
