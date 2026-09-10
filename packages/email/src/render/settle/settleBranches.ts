/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { check } from '@inixiative/json-rules';
import type { Branch } from '@template/email/render/conditionParser';
import { emailRuleNarrowing } from '@template/email/rules/emailRuleLens';
import { ruleReferences } from '@template/email/rules/ruleReferences';
import { withRule } from '@template/shared/rules';
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

    const rule = branch.rule!;
    const rendered = withRule(
      { lens: emailRuleNarrowing, rule, references: ruleReferences(emailRuleNarrowing, rule), live: options.liveRefs },
      {
        degraded: (issues) =>
          onBlockError(issues.map((issue) => issue.detail).join('; '), branch.body, scope, options, onError),
        sound: (sound) => {
          try {
            return check(sound, toRuleData(scope)) === true ? settle(branch.body, scope, options, onError) : null;
          } catch (err) {
            return onBlockError(err instanceof Error ? err.message : 'Unknown error', branch.body, scope, options, onError);
          }
        },
      },
    );
    if (rendered !== null) return rendered;
  }

  return '';
};
