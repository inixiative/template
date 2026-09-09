/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Lens } from '@inixiative/json-rules';
import { EMAIL_RULE_MAP_NAME, EMAIL_RULE_ROOT_MODEL } from '@template/email/rules/emailProjection';
import { startCase } from 'lodash-es';

export type EmailRuleFacet = { path: string; label: string };
export type EmailRuleDecoration = { facets: EmailRuleFacet[] };

export const emailRuleDecoration = (surface: Lens): EmailRuleDecoration => {
  const rootFields = surface.maps[EMAIL_RULE_MAP_NAME]?.models[EMAIL_RULE_ROOT_MODEL]?.fields ?? {};
  const facets = Object.entries(rootFields)
    .filter(([, field]) => field.kind === 'object')
    .map(([name]) => ({ path: name, label: startCase(name) }));
  return { facets };
};
