/**
 * @atlas
 * @kind constant
 * @partOf feature:segment
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';

export const segmentConditionExamples: Condition[] = [
  { all: [] },
  {
    field: 'customerUser.contacts',
    arrayOperator: 'any',
    condition: { field: 'type', operator: Operator.equals, value: 'email' },
  },
];
