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
import {
  applyEmailLens,
  defaultEmailLens,
  emailRuleReferences,
  emailRuleVocabulary,
  evaluateScopedRule,
} from '@template/email/rules/emailLens';
import { iteratesLens, loopFrames, loopIndices, narrowToElements, scopedRule } from '@template/email/rules/scopedRule';
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
    const lens = options.lens ?? defaultEmailLens;
    const scoped = scopedRule(rule, options.bindings, {
      lens,
      indices: options.bindings && loopIndices(scope, options.bindings),
    });
    if (scoped.issue !== undefined) {
      onError?.({ kind: 'rule', detail: scoped.issue });
      continue;
    }
    const judged = scoped.rule;
    const frames = loopFrames(options.bindings ?? new Map());
    const lensed = iteratesLens(options.bindings, lens);
    const evaluate = (): string | null => {
      try {
        const passes = lensed
          ? evaluateScopedRule(lens, judged, toRuleData(narrowToElements(scope, frames)))
          : check(frames.length ? rule : applyEmailLens(lens, rule), toRuleData(scope));
        return passes === true ? settle(branch.body, scope, options, onError) : null;
      } catch (err) {
        onError?.({ kind: 'rule', detail: err instanceof Error ? err.message : 'Unknown error' });
        return null;
      }
    };
    const rendered =
      frames.length && !lensed
        ? evaluate()
        : withRule(
            {
              lens: emailRuleVocabulary(lens),
              rule: judged,
              references: emailRuleReferences(lens, judged),
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
