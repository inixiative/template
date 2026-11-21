/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { type EntitlementTarget, type HydratedRecord, hydrate } from '@template/db';
import { type Permix, TokenAction } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import type { EntitlementChanges } from '#/lib/permissions/changeEntitlements';
import { validateDelegateRole } from '#/lib/permissions/validateDelegateRole';
import { validateMemberGrant } from '#/lib/permissions/validateMemberGrant';
import { validateIntegrationRole } from '#/modules/integration/validations/validateIntegrationRole';
import { validateTokenWrite } from '#/modules/token/validations/validateTokenWrite';

type Holder = Record<string, unknown>;
type Changes = Required<{ [K in keyof EntitlementChanges]: unknown[] }>;

const validateTokenWriter = async (writer: Permix, token: Holder, { add, remove }: Changes) => {
  const row = await hydrate('token', token as HydratedRecord);
  if (add.length) {
    await validateTokenWrite(writer, token);
    validateDelegateRole(row);
  }
  if (remove.length && !check(writer, rebacSchema, 'token', row, TokenAction.delete))
    throw makeError({ status: 403, message: 'Access denied' });
};

const holderWriters: Record<
  EntitlementTarget['model'],
  (writer: Permix, holder: Holder, changes: Changes) => Promise<unknown>
> = {
  Token: validateTokenWriter,
  Integration: (writer, integration) => validateIntegrationRole(writer, integration),
  OrganizationUser: (writer, member) =>
    validateMemberGrant(writer, 'organizationUser', member as HydratedRecord),
  SpaceUser: (writer, member) => validateMemberGrant(writer, 'spaceUser', member as HydratedRecord),
};

/** Whether this writer may change this holder's entitlements: the one check every add route, remove route and approval runs before the writer. */
export const validateEntitlementWriter = async (
  writer: Permix,
  model: EntitlementTarget['model'],
  holder: Holder,
  { add = [], remove = [] }: EntitlementChanges,
): Promise<void> => {
  await holderWriters[model](writer, holder, { add, remove });
};
