import { FieldKind, getOperatorsForKind, type Operator } from '@inixiative/json-rules';
import type { FieldOperator } from '@template/shared/lib/bracketQuery/operators';

const JSON_RULES_TO_BRACKET: Partial<Record<Operator, FieldOperator>> = {
  greaterThanEquals: 'gte',
  lessThanEquals: 'lte',
  greaterThan: 'gt',
  lessThan: 'lt',
  equals: 'equals',
  notEquals: 'not',
  contains: 'contains',
  in: 'in',
  notIn: 'notIn',
  startsWith: 'startsWith',
  endsWith: 'endsWith',
};

export const operatorsForFieldKind = (kind: FieldKind): FieldOperator[] => {
  const { field } = getOperatorsForKind(kind);
  const mapped: FieldOperator[] = [];
  for (const operator of field) {
    const bracket = JSON_RULES_TO_BRACKET[operator];
    if (bracket) mapped.push(bracket);
  }
  return mapped;
};
