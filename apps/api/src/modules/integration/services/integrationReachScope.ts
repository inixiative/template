/**
 * @atlas
 * @kind helper
 * @partOf feature:integrations, primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import type { Context } from 'hono';
import type { WhereScope } from '#/middleware/resources/scopeNarrowing';
import type { AppEnv } from '#/types/appEnv';

export const integrationReachScope = (c: Context<AppEnv>): WhereScope => {
  const permix = c.get('permix');
  const actor = permix.getActor();
  if (permix.isSuperadmin() || actor?.integrationReach === 'all') return {};
  return {
    root: { where: { field: 'id', operator: Operator.in, value: actor?.integrationIds ?? [] } },
  };
};
