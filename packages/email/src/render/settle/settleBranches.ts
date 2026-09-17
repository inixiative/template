/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { check } from '@inixiative/json-rules';
import type { Branch } from '@template/email/render/conditionParser';
import { settle } from '@template/email/render/settle/settle';
import { toRuleData } from '@template/email/render/settle/toRuleData';
import type { RuleErrorSink, Scope, SettleOptions } from '@template/email/render/settle/types';
import { absoluteRule } from '@template/email/rules/absoluteRule';
import { emailRuleNarrowing } from '@template/email/rules/emailRuleLens';
import { ruleReferences } from '@template/email/rules/ruleReferences';
import { withRule } from '@template/shared/rules';

export const settleBranches = (
  branches: Branch[],
  scope: Scope,
  options: SettleOptions,
  onError?: RuleErrorSink,
): string => {
  for (const branch of branches) {
    if (branch.kind === 'else') return settle(branch.body, scope, options, onError);

    if (branch.ruleError !== undefined) {
      onError?.({ kind: 'rule', detail: branch.ruleError });
      continue;
    }

    const rule = branch.rule!;
    const evaluate = (): string | null => {
      try {
        return check(rule, toRuleData(scope)) === true ? settle(branch.body, scope, options, onError) : null;
      } catch (err) {
        onError?.({ kind: 'rule', detail: err instanceof Error ? err.message : 'Unknown error' });
        return null;
      }
    };
    const judged = absoluteRule(rule, options.bindings);
    const rendered =
      judged === undefined
        ? evaluate()
        : withRule(
            {
              lens: options.lens ?? emailRuleNarrowing,
              rule: judged,
              references: ruleReferences(emailRuleNarrowing, judged),
              live: options.liveRefs,
            },
            {
              degraded: (issues) => {
                onError?.({ kind: 'rule', detail: issues.map((issue) => issue.detail).join('; ') });
                return null;
              },
              sound: evaluate,
            },
          );
    if (rendered !== null) return rendered;
  }

  return '';
};
