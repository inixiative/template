import { FieldKind, getOperatorsForKind, type Operator } from '@inixiative/json-rules';
import type { FieldOperator } from '@template/shared/lib/bracketQuery/operators';

// Maps json-rules Operator names to the bracket/Prisma operator names the filter system uses.
// json-rules operators without a bracket equivalent (matches, between, isEmpty, etc.) are dropped.
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

export { FieldKind };
export type { Operator };

export const operatorsForFieldKind = (kind: FieldKind): FieldOperator[] => {
  const { field } = getOperatorsForKind(kind);
  const mapped: FieldOperator[] = [];
  for (const operator of field) {
    const bracket = JSON_RULES_TO_BRACKET[operator];
    if (bracket) mapped.push(bracket);
  }
  return mapped;
};
