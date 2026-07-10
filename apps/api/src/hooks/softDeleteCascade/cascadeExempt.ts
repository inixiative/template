/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */

// Reference relations that do NOT cascade, keyed by child model → its relation
// field. An FK is ownership by default; list the edges that merely point at a
// counterparty or an author — those rows outlive the referenced parent.
export const CASCADE_EXEMPT: Record<string, readonly string[]> = {
  CustomerRef: ['customerOrganization', 'customerSpace', 'customerUser'],
  Inquiry: ['sourceOrganization', 'sourceSpace', 'sourceUser'],
};
