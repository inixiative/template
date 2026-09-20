/**
 * @atlas
 * @kind validator
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import {
  applyLens,
  type Condition,
  checkRuleAgainstLens,
  type LensNarrowing,
  RuleTarget,
  toPrisma,
  validateRule,
} from '@inixiative/json-rules';
import { rootLens } from '@template/db/lens/rootLens';
import type { RuleLens } from '@template/shared/rules';

export type RuleValidation = { valid: boolean; errors: string[]; normalized: unknown };

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node => !!value && typeof value === 'object' && !Array.isArray(value);

const isVacuouslyTrue = (node: unknown): boolean => {
  if (!isNode(node)) return false;
  if (Array.isArray(node.all)) return node.all.length === 0 || node.all.every(isVacuouslyTrue);
  if (Array.isArray(node.any)) return node.any.length === 0 || node.any.some(isVacuouslyTrue);
  return false;
};

const emptyArmInsideAny = (node: unknown, path = '$'): string | null => {
  if (!isNode(node)) return null;
  if (Array.isArray(node.any)) {
    for (const [index, arm] of (node.any as unknown[]).entries()) {
      if (isVacuouslyTrue(arm)) {
        return `${path}.any[${index}]: an empty group inside \`any\` matches every row, so the whole rule does; remove the arm instead`;
      }
    }
  }
  for (const key of ['all', 'any'] as const) {
    if (!Array.isArray(node[key])) continue;
    for (const [index, child] of (node[key] as unknown[]).entries()) {
      const found = emptyArmInsideAny(child, `${path}.${key}[${index}]`);
      if (found) return found;
    }
  }
  for (const key of ['if', 'then', 'else', 'condition'] as const) {
    if (node[key] === undefined) continue;
    const found = emptyArmInsideAny(node[key], `${path}.${key}`);
    if (found) return found;
  }
  return null;
};

/** `{ arrayOperator: 'any' }` with no condition means "has any element" — anchor it so every rail reads it the same way. */
const anchorBareQuantifiers = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(anchorBareQuantifiers);
  if (!isNode(node)) return node;
  const out: Node = { ...node };
  for (const key of ['all', 'any', 'if', 'then', 'else', 'condition'] as const) {
    if (out[key] !== undefined) out[key] = anchorBareQuantifiers(out[key]);
  }
  if (out.arrayOperator && out.condition === undefined) {
    const quantifier =
      out.arrayOperator === 'none' || out.arrayOperator === 'empty'
        ? 'none'
        : out.arrayOperator === 'any' || out.arrayOperator === 'notEmpty'
          ? 'any'
          : null;
    if (quantifier) return { ...out, arrayOperator: quantifier, condition: { all: [] } };
  }
  return out;
};

export type ValidateRuleForLensOptions = {
  /** A resolved narrowing to compile through, proving the rule is evaluable on the set rail. */
  compileWith?: LensNarrowing;
  target?: RuleTarget;
};

/** Grammar, vocabulary, open arms, and (optionally) a compile probe — the lens-driven validation every rule owner shares. */
export const validateRuleForLens = (
  raw: unknown,
  lens: RuleLens,
  { compileWith, target = RuleTarget.toPrisma }: ValidateRuleForLensOptions = {},
): RuleValidation => {
  const normalized = anchorBareQuantifiers(raw);
  const invalid = (errors: string[]): RuleValidation => ({ valid: false, errors, normalized });

  const structural = validateRule(normalized, { target });
  if (!structural.ok) return invalid(structural.errors.map((error) => `${error.path}: ${error.message}`));

  const rule = normalized as Condition;
  const vocabulary = checkRuleAgainstLens(rule, lens);
  if (!vocabulary.ok)
    return invalid(vocabulary.violations.map((violation) => `${violation.path}: ${violation.reason}`));

  const openArm = emptyArmInsideAny(rule);
  if (openArm) return invalid([openArm]);

  if (compileWith) {
    try {
      const root = rootLens(compileWith);
      toPrisma(applyLens(rule, compileWith), { map: root, mapName: root.mapName, model: root.model });
    } catch (error) {
      return invalid([error instanceof Error ? error.message : 'rule is not evaluable under the lens']);
    }
  }
  return { valid: true, errors: [], normalized: rule };
};
