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
  // A rule names these rows; it does not own them. Tombstoning one stamps the edges that name it
  // (ruleReference:target) — deleting them would erase the record that a rule is degraded.
  RuleReference: ['tag', 'organization', 'space', 'targetSegment'],
};
