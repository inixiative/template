/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { check } from '@inixiative/json-rules';
import type { Branch } from '@template/email/render/conditionParser';
import { onBlockError } from '@template/email/render/settle/onBlockError';
import { settle } from '@template/email/render/settle/settle';
import { toRuleData } from '@template/email/render/settle/toRuleData';
import type { RuleErrorSink, Scope, SettleOptions } from '@template/email/render/settle/types';

export const settleBranches = (
  branches: Branch[],
  scope: Scope,
  options: SettleOptions,
  onError?: RuleErrorSink,
): string => {
  for (const branch of branches) {
    if (branch.kind === 'else') return settle(branch.body, scope, options, onError);

    if (branch.ruleError !== undefined) {
      const rendered = onBlockError(branch.ruleError, branch.body, scope, options, onError);
      if (rendered !== null) return rendered;
      continue;
    }

    try {
      if (check(branch.rule!, toRuleData(scope)) === true) return settle(branch.body, scope, options, onError);
    } catch (err) {
      const rendered = onBlockError(
        err instanceof Error ? err.message : 'Unknown error',
        branch.body,
        scope,
        options,
        onError,
      );
      if (rendered !== null) return rendered;
    }
  }

  return '';
};
