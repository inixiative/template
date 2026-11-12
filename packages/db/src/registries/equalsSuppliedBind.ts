/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';

export const equalsSuppliedBind = (field: string, bind: string): Condition => ({
  all: [
    { field, operator: Operator.exists },
    { field, operator: Operator.equals, bind, bindOptional: true },
  ],
});
