/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';
import { polymorphicIs } from '@template/db/registries/polymorphicIs';
import type { ModelName } from '@template/db/utils/modelNames';

/** Not soft-deleted. */
export const live: Condition = { field: 'deletedAt', operator: Operator.notExists };

/** A platform row, or one whose axis points at the bound owner — live either way. */
export const platformOrBound = (model: ModelName, axis: string): Condition => ({
  all: [live, { any: [{ field: axis, operator: Operator.equals, value: 'platform' }, polymorphicIs(model, axis)] }],
});

/** A live row whose axis points at the bound owner. */
export const boundAndLive = (model: ModelName, axis: string): Condition => ({
  all: [polymorphicIs(model, axis), live],
});
