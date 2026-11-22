/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { ActionRule, AdditionalRules } from '@inixiative/permissions';
import { issuesWithStoredRule } from '@template/permissions/rebac/issuesWithStoredRule';
import { StoredPermissionRuleRefusedError } from '@template/permissions/rebac/storedPermissionRuleRefusedError';
import { tenantPermissionRulesAbove } from '@template/permissions/rebac/tenantPermissionRules';
import { isPlainObject } from 'lodash-es';

const recordsAlreadyRead = new WeakSet<object>();

const throwIfTheRecordsOwnRulesAreRefused = (resource: string, record: Record<string, unknown>) => {
  if (recordsAlreadyRead.has(record) || !isPlainObject(record.permissionRules)) return;
  const rowRules = record.permissionRules as Record<string, ActionRule>;
  for (const [action, rule] of Object.entries(rowRules)) {
    const [issue] = issuesWithStoredRule(resource, action, rule, { rowRules });
    if (issue)
      throw new StoredPermissionRuleRefusedError(
        `the record's own stored rule for \`${resource}.${action}\` is refused: ${issue.path}: ${issue.message}`,
      );
  }
  recordsAlreadyRead.add(record);
};

/**
 * What every engine entry is given as `additionalRules`: the rules of the tenants above a record,
 * after theirs and then the record's own `permissionRules` are checked. A refused one throws
 * `StoredPermissionRuleRefusedError` here, before the library reads it.
 */
export const rulesStoredBesideTheSchema: AdditionalRules = (resource, record) => {
  const rulesOfTenantsAbove = tenantPermissionRulesAbove(resource, record);
  throwIfTheRecordsOwnRulesAreRefused(resource, record);
  return rulesOfTenantsAbove;
};
