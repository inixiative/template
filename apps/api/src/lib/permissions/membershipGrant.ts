/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { Prisma, Role } from '@template/db/generated/client/client';
import type { Entitlements, Grant } from '@template/permissions';
import { validateRole } from '#/lib/permissions/validateRole';

export const membershipGrant = (membership: {
  role: Role;
  entitlements: Prisma.JsonValue;
}): Grant => ({
  role: validateRole(membership.role),
  entitlements: membership.entitlements as Entitlements,
});

export const membershipSelfGrant: Grant = { role: 'owner', entitlements: null };
