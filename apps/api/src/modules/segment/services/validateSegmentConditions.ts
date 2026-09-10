/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import {
  applyLens,
  type Condition,
  checkRuleAgainstLens,
  RuleTarget,
  toPrisma,
  validateRule,
} from '@inixiative/json-rules';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { rootLens } from '@template/db/lens';
import { resolvedSegmentLens, segmentLensFor } from '#/modules/segment/lib/segmentLens';
import { segmentReferences } from '#/modules/segment/services/segmentReferences';

const PROBE_OWNER_ID = '00000000-0000-7000-8000-000000000000';

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
        return `${path}.any[${index}]: an empty group inside \`any\` matches every customer, so the whole segment does; remove the arm instead`;
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

export type ConditionsValidation = { valid: boolean; errors: string[]; normalized: unknown };

export const validateSegmentConditions = (
  rawConditions: unknown,
  ownerModel: ProviderModel,
  options: { selfId?: string } = {},
): ConditionsValidation => {
  const normalized = anchorBareQuantifiers(rawConditions);
  const invalid = (errors: string[]): ConditionsValidation => ({ valid: false, errors, normalized });

  const structural = validateRule(normalized, { target: RuleTarget.toPrisma });
  if (!structural.ok) return invalid(structural.errors.map((error) => `${error.path}: ${error.message}`));

  const conditions = normalized as Condition;
  const lens = segmentLensFor(ownerModel);

  const vocabulary = checkRuleAgainstLens(conditions, lens);
  if (!vocabulary.ok)
    return invalid(vocabulary.violations.map((violation) => `${violation.path}: ${violation.reason}`));

  const openArm = emptyArmInsideAny(conditions);
  if (openArm) return invalid([openArm]);

  const references = segmentReferences(conditions, lens);
  if (references.dynamic) {
    return invalid([
      'a membership rule must name the segment it references; reading it from a path or bind is refused',
    ]);
  }
  if (options.selfId && references.ids.includes(options.selfId)) {
    return invalid(['a segment cannot reference its own membership']);
  }

  try {
    const resolved = resolvedSegmentLens(ownerModel, PROBE_OWNER_ID);
    const root = rootLens(resolved);
    toPrisma(applyLens(conditions, resolved), { map: root, mapName: root.mapName, model: root.model });
  } catch (error) {
    return invalid([error instanceof Error ? error.message : 'conditions are not evaluable under the lens']);
  }

  return { valid: true, errors: [], normalized: conditions };
};
