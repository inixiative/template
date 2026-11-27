/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses primitive:shared
 */
import { check } from '@inixiative/json-rules';
import type { Branch } from '@template/email/render/conditionParser';
import { evaluateTemplateBlocksAndTokens } from '@template/email/render/evaluateTemplate/evaluateTemplateBlocksAndTokens';
import { toRuleData } from '@template/email/render/evaluateTemplate/toRuleData';
import type {
  RuleErrorSink,
  Scope,
  TemplateEvaluationOptions,
} from '@template/email/render/evaluateTemplate/types';
import {
  applyEmailLens,
  defaultEmailLens,
  emailRuleReferences,
  emailRuleVocabulary,
  evaluateScopedRule,
} from '@template/email/rules/emailLens';
import {
  iteratesLens,
  loopFrames,
  loopIndices,
  narrowToElements,
  opaqueLoopIssue,
  scopedRule,
} from '@template/email/rules/scopedRule';
import { branchOnRuleHealth } from '@template/shared/rules';

export const evaluateIfBranches = (
  branches: Branch[],
  scope: Scope,
  options: TemplateEvaluationOptions,
  onError?: RuleErrorSink,
): string => {
  for (const branch of branches) {
    if (branch.kind === 'else')
      return evaluateTemplateBlocksAndTokens(branch.body, scope, options, onError);

    if (branch.ruleError !== undefined) {
      onError?.({ kind: 'rule', detail: branch.ruleError });
      continue;
    }

    const rule = branch.rule!;
    const { lens } = options;
    const opaque = opaqueLoopIssue(rule, options.bindings, lens);
    if (opaque !== undefined) {
      onError?.({ kind: 'rule', detail: opaque });
      continue;
    }
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
    const ruleScope = options.ruleScope ?? scope;
    const checkOptions = options.now ? { now: options.now } : undefined;
    const evaluate = (): string | null => {
      try {
        const passes = lensed
          ? evaluateScopedRule(
              lens,
              judged,
              toRuleData(narrowToElements(ruleScope, frames)),
              checkOptions,
            )
          : frames.length
            ? check(rule, toRuleData(scope), checkOptions)
            : check(applyEmailLens(lens, rule), toRuleData(ruleScope), checkOptions);
        return passes === true
          ? evaluateTemplateBlocksAndTokens(branch.body, scope, options, onError)
          : null;
      } catch (err) {
        onError?.({ kind: 'rule', detail: err instanceof Error ? err.message : 'Unknown error' });
        return null;
      }
    };
    const rendered =
      frames.length && !lensed
        ? evaluate()
        : branchOnRuleHealth(
            {
              lens: emailRuleVocabulary(lens),
              rule: judged,
              references: emailRuleReferences(lens, judged),
              existingTargets: options.existingTargets,
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
