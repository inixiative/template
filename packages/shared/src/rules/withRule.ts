/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared
 * @uses none
 */
import {
  type Condition,
  checkRuleAgainstLens,
  type Lens,
  type LensNarrowing,
  type RuleValue,
  requiredBindings,
} from '@inixiative/json-rules';

export type RuleLens = Lens | LensNarrowing;

/** A row a stored rule names by id. `model` is the lens's model name for that source. */
export type RuleReference = { model: string; id: string };

export const referenceKey = (reference: RuleReference): string => `${reference.model}|${reference.id}`;

/** One way a stored rule has stopped having a correct evaluation. */
export type RuleIssue =
  | { kind: 'binding'; name: string; detail: string }
  | { kind: 'vocabulary'; detail: string }
  | { kind: 'reference'; reference: RuleReference; detail: string };

export type RuleHealth = {
  lens: RuleLens;
  rule: Condition;
  /** The rows the rule names, extracted by the caller's rules module — it knows which sources are ids. */
  references: RuleReference[];
  /** Reference keys confirmed usable by the caller's own read. Absent means none were confirmed. */
  live?: ReadonlySet<string>;
  /** The bindings the caller evaluates with. A required name outside this map is an issue. */
  bindings?: Record<string, RuleValue>;
};

export type RuleArms<T> = {
  /** The rule cannot be evaluated correctly. Do nothing new; say why. */
  degraded: (issues: RuleIssue[]) => T;
  /** The rule is sound. Evaluate it. */
  sound: (rule: Condition) => T;
};

export const ruleIssues = ({ lens, rule, references, live, bindings }: RuleHealth): RuleIssue[] => {
  const issues: RuleIssue[] = [];
  for (const name of requiredBindings(rule)) {
    if (bindings && Object.hasOwn(bindings, name)) continue;
    issues.push({ kind: 'binding', name, detail: `rule requires a binding that was not supplied: ${name}` });
  }
  for (const violation of checkRuleAgainstLens(rule, lens).violations) {
    issues.push({
      kind: 'vocabulary',
      detail: `rule is outside the lens vocabulary — ${violation.path}: ${violation.reason}`,
    });
  }
  for (const reference of references) {
    if (live?.has(referenceKey(reference))) continue;
    issues.push({
      kind: 'reference',
      reference,
      detail: `rule names a ${reference.model} that no longer resolves: ${reference.id}`,
    });
  }
  return issues;
};

/**
 * Evaluate a stored rule through one fork: `degraded` when it cannot be evaluated correctly,
 * `sound` when it can. Two questions: is every binding the rule requires supplied, and is the
 * rule still valid — admitted by the current lens, every row it names still live.
 */
export const withRule = <T>(health: RuleHealth, arms: RuleArms<T>): T => {
  const issues = ruleIssues(health);
  return issues.length ? arms.degraded(issues) : arms.sound(health.rule);
};
