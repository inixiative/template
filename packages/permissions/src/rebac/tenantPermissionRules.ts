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

/**
 * The rules each tenant above a record holds for its resource (`tenantPermissionRules`), cut to
 * the actions that tenant's lens shows, for `check()` to OR in.
 */
export const tenantPermissionRulesAbove: AdditionalRules = (resource, record) =>
  tenantRowsAbove(record).map(({ model, row }) =>
    pick(
      (row.tenantPermissionRules as RulesByResource | null | undefined)?.[resource] ?? {},
      actionsTenantMayExtend(model, resource),
    ),
  );
