/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { ActionRule, AdditionalRules } from '@inixiative/permissions';
import { tenantRowsAbove } from '@template/db/utils/tenantRowsAbove';

type RulesByResource = Record<string, Record<string, ActionRule>>;

/** The rules each tenant above a record holds for its resource (`tenantPermissionRules`), for `check()` to OR in. */
export const tenantPermissionRulesAbove: AdditionalRules = (resource, record) =>
  tenantRowsAbove(record).map(
    (tenant) => (tenant.tenantPermissionRules as RulesByResource | null | undefined)?.[resource],
  );
