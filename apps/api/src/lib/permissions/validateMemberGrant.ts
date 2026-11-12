/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses infrastructure:prisma, primitive:errors
 */
import { type HydratedRecord, hydrate } from '@template/db';
import type { Permix } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { memberRoleWrite } from '@template/permissions/rebac/schemaHelpers';
import { makeError } from '#/lib/errors';

const tenantOf = { organizationUser: 'organization', spaceUser: 'space' } as const;

/** A member's entitlements are written by whoever may write its role. */
export const validateMemberGrant = async (
  writer: Permix,
  accessor: keyof typeof tenantOf,
  member: HydratedRecord,
): Promise<void> => {
  const row = await hydrate(accessor, member);
  if (!check(writer, rebacSchema, accessor, row, memberRoleWrite(tenantOf[accessor])))
    throw makeError({ status: 403, message: 'Access denied' });
};
