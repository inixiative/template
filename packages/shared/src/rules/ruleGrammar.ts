/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared
 * @uses none
 */
import {
  ALL_KINDS,
  ArrayOperator,
  DateOperator,
  type FieldKind,
  getAggregateOperators,
  getArrayOperators,
  getOperatorsForKind,
  getValueShape,
  Operator,
  type RuleTarget,
  type ValueShape,
} from '@inixiative/json-rules';
import { type RuleNode, ruleNodes } from '@template/shared/rules/ruleNodes';

export type RuleGrammar = {
  nodes: RuleNode[];
  operators: {
    field: Record<FieldKind, Operator[]>;
    date: Record<FieldKind, DateOperator[]>;
    array: ArrayOperator[];
    aggregate: Operator[];
  };
  valueShapes: {
    field: Record<Operator, ValueShape>;
    date: Record<DateOperator, ValueShape>;
    array: Record<ArrayOperator, ValueShape>;
  };
};

const shapesOf = <TOperator extends string>(
  operators: readonly TOperator[],
  family: 'field' | 'date' | 'array',
): Record<TOperator, ValueShape> =>
  Object.fromEntries(
    operators.map((operator) => [operator, getValueShape(operator, family)]),
  ) as Record<TOperator, ValueShape>;

const operatorsByKind = <TOperator>(
  pick: (kind: FieldKind) => TOperator[],
): Record<FieldKind, TOperator[]> =>
  Object.fromEntries(ALL_KINDS.map((kind) => [kind, pick(kind)])) as Record<FieldKind, TOperator[]>;

export const ruleGrammar = (target: RuleTarget): RuleGrammar => ({
  nodes: ruleNodes,
  operators: {
    field: operatorsByKind((kind) => getOperatorsForKind(kind, target).field),
    date: operatorsByKind((kind) => getOperatorsForKind(kind, target).date),
    array: getArrayOperators(target),
    aggregate: [...getAggregateOperators()],
  },
  valueShapes: {
    field: shapesOf(Object.values(Operator), 'field'),
    date: shapesOf(Object.values(DateOperator), 'date'),
    array: shapesOf(Object.values(ArrayOperator), 'array'),
  },
});
