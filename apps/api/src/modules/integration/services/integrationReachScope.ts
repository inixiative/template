/**
 * @atlas
 * @kind helper
 * @partOf feature:integrations, primitive:authz
 * @uses none
 */
import { bindRule } from '@inixiative/json-rules';
import { check, rebacSchema } from '@template/permissions/rebac';
import { listsIntegration, reachesAllIntegrations } from '@template/permissions/rebac/ownerActions';
import type { Context } from 'hono';
import type { WhereScope } from '#/middleware/resources/scopeNarrowing';
import type { AppEnv } from '#/types/appEnv';

export const integrationReachScope = (c: Context<AppEnv>): WhereScope => {
  const permix = c.get('permix');
  if (check(permix, rebacSchema, 'integration', { id: '' }, reachesAllIntegrations)) return {};
  const integrationIds = permix.getActor()?.integrationIds ?? [];
  return {
    root: { where: bindRule(listsIntegration.rule, { 'actor.integrationIds': integrationIds }) },
  };
};
