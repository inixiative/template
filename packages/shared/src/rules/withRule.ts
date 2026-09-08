/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared
 * @uses none
 */
import { type Condition, checkRuleAgainstLens, type Lens, type LensNarrowing } from '@inixiative/json-rules';

export type RuleLens = Lens | LensNarrowing;

/** A row a stored rule names by id. `model` is the lens's model name for that source. */
export type RuleReference = { model: string; id: string };

export type RuleReferences = {
  references: RuleReference[];
  /** The rule reads a referenced row from `path` / `bind`, or describes it without naming it. */
  dynamic: boolean;
};

export const referenceKey = (reference: RuleReference): string => `${reference.model}|${reference.id}`;

/** One way a stored rule has stopped having a correct evaluation. */
export type RuleIssue =
  | { kind: 'vocabulary'; detail: string }
  | { kind: 'dynamic'; detail: string }
  | { kind: 'missing'; detail: string; reference: RuleReference };

export type RuleHealth = {
  lens: RuleLens;
  rule: Condition;
  /** The rows the rule names, extracted by the caller's rules module — it knows which sources are ids. */
  references: RuleReferences;
  /** Reference keys confirmed usable by the caller's own read. Absent means none were confirmed. */
  live?: ReadonlySet<string>;
};

export type RuleArms<T> = {
  /** The rule cannot be evaluated correctly. Do nothing new; say why. */
  degraded: (issues: RuleIssue[]) => T;
  /** The rule is sound. Evaluate it. */
  sound: (rule: Condition) => T;
};

// why: a stored rule degrades two ways — the lens stops admitting it, or a row it names is gone —
// why: and both are asked here, at evaluation, against the current lens and the caller's live set.
// why: Absence is the answer on every arm: a reference nobody confirmed is missing, a lens that
// why: no longer resolves the rule is a violation. Nothing is stored and nothing is inferred.
export const ruleIssues = ({ lens, rule, references, live }: RuleHealth): RuleIssue[] => {
  const issues: RuleIssue[] = checkRuleAgainstLens(rule, lens).violations.map((violation) => ({
    kind: 'vocabulary',
    detail: `rule is outside the lens vocabulary — ${violation.path}: ${violation.reason}`,
  }));
  if (references.dynamic) {
    issues.push({
      kind: 'dynamic',
      detail: 'rule reads a referenced row from path or bind, or describes it without naming it — refusing to evaluate',
    });
  }
  for (const reference of references.references) {
    if (live?.has(referenceKey(reference))) continue;
    issues.push({
      kind: 'missing',
      detail: `rule names a ${reference.model} that no longer resolves: ${reference.id}`,
      reference,
    });
  }
  return issues;
};

/**
 * Evaluate a stored rule through one fork: `degraded` when it cannot be evaluated correctly,
 * `sound` when it can. Every surface that runs stored rules goes through here, so the fallback
 * is declared where the rule is used and cannot be forgotten.
 */
export const withRule = <T>(health: RuleHealth, arms: RuleArms<T>): T => {
  const issues = ruleIssues(health);
  return issues.length ? arms.degraded(issues) : arms.sound(health.rule);
};
