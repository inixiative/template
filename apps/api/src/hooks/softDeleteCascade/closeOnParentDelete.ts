/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses infrastructure:prisma
 */
import { type Categorization, categorize, Operator } from '@inixiative/json-rules';
import { db } from '@template/db';
import { inquiryCancellation } from '#/modules/inquiry/services/inquiryCancellation';
import { inquiryTerminalStatuses } from '#/modules/inquiry/validations/validateInquiryStatus';

// Children a parent's delete closes instead of burying, keyed by the child. Each child row is put in
// a category; a row whose category is a field/value map gets it written, a row with none is left.
// Nothing is tombstoned, so every row stays not-deleted as the record of what happened. Every parent of a
// model listed here must be soft-delete only (validateDeleteBehavior), so a hard delete can never
// take the record with it.
export const CLOSE_ON_PARENT_DELETE: Record<string, Categorization> = {
  // An open inquiry whose party is gone can no longer be answered: it is canceled (Aron, 2026-11-16).
  Inquiry: {
    cases: [
      {
        if: { field: 'status', operator: Operator.notIn, value: inquiryTerminalStatuses },
        then: { value: inquiryCancellation },
      },
    ],
  },
};

export const isClosedOnParentDelete = (model: string): boolean =>
  Object.hasOwn(CLOSE_ON_PARENT_DELETE, model);

// One update per row, each through the lifecycle (audited), with the row's own category.
export const closeChildren = async (
  model: string,
  where: Record<string, unknown>,
  categorization: Categorization,
) => {
  const rows = (await db.delegate(model).findMany({ where })) as Record<string, unknown>[];
  for (const row of rows) {
    const data = categorize(categorization, row) as Record<string, unknown> | null;
    if (data) await db.delegate(model).update({ where: { id: row.id }, data });
  }
};
