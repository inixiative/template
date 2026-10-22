/**
 * @atlas
 * @kind middleware
 * @partOf primitive:requestContext, primitive:authz
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';
import type { AccessorName } from '@template/db';
import { parseGrantKey } from '@template/permissions';
import type { Context } from 'hono';
import type { WhereScope } from '#/middleware/resources/scopeNarrowing';
import type { AppEnv } from '#/types/appEnv';

const NONE: Condition = { field: 'id', operator: Operator.in, value: [] };

const credentialRole = (c: Context<AppEnv>) => {
  const token = c.get('token');
  if (token) return token.role;
  return c.get('entitlementGrant')?.role ?? 'owner';
};

export const entitlementScope =
  (model: AccessorName) =>
  (c: Context<AppEnv>): WhereScope => {
    if (credentialRole(c)) return {};
    const resource = `db:${model}`;
    const permix = c.get('permix');
    const arms: Condition[] = [];
    for (const [key, actions] of Object.entries(permix.getJSON() ?? {})) {
      const { resource: keyResource, id } = parseGrantKey(key);
      if (keyResource === resource && id && actions.read)
        arms.push({ field: 'id', operator: Operator.equals, value: id });
    }
    for (const entry of permix.rules(resource, 'read')) {
      if (typeof entry.rule !== 'object' || entry.rule === null || !('rule' in entry.rule))
        continue;
      const byId: Condition = { field: 'id', operator: Operator.equals, value: entry.id ?? '' };
      arms.push(entry.id ? { all: [byId, entry.rule.rule] } : entry.rule.rule);
    }
    return { root: { where: arms.length ? { any: arms } : NONE } };
  };
