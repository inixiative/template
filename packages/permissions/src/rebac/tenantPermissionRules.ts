/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { ActionRule, AdditionalRules } from '@inixiative/permissions';
import { tenantRowsAbove } from '@template/db/utils/tenantRowsAbove';
import { actionsTenantMayExtend } from '@template/permissions/rebac/tenantPermissionRulesLens';
import { pick } from 'lodash-es';

type RulesByResource = Record<string, Record<string, ActionRule>>;

const MEMBER_OWNER_MODELS = new Set(['OrganizationUser', 'SpaceUser']);

/**
 * The rules each tenant above a record holds for its resource (`tenantPermissionRules`), cut to
 * the actions that tenant's lens shows, for `check()` to OR in.
 * Private member-owned records (`OrganizationUser` / `SpaceUser`) stay isolated from tenant rules.
 */
export const tenantPermissionRulesAbove: AdditionalRules = (resource, record) => {
  if (typeof record.ownerModel === 'string' && MEMBER_OWNER_MODELS.has(record.ownerModel)) {
    return [];
  }
  return tenantRowsAbove(record).map(({ model, row }) =>
    pick(
      (row.tenantPermissionRules as RulesByResource | null | undefined)?.[resource] ?? {},
      actionsTenantMayExtend(model, resource),
    ),
  );
};
