/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getPolymorphismConfig } from '@template/db';

// The relation names of a false-polymorphic axis, one per model it can point at.
const axisRelations = (model: 'Entitlement' | 'Inquiry' | 'RuleReference', side: string) =>
  Object.keys(
    getPolymorphismConfig(model)?.axes.find((axis) => axis.field === `${side}Model`)?.fkMap ?? {},
  )
    .filter((value) => value !== 'admin')
    .map((value) => `${side}${value}`);

// Reference relations that do NOT cascade, keyed by child model → its relation
// field. An FK is ownership by default; list the edges that merely point at a
// counterparty or an author — those rows outlive the referenced parent.
export const CASCADE_EXEMPT: Record<string, readonly string[]> = {
  CustomerRef: ['customerOrganization', 'customerSpace', 'customerUser'],
  // An entitlement acts from its anchor; it does not belong to it. A deleted anchor is stamped on
  // the row (`sourceDeletedAt`), and the row dies only with its target.
  Entitlement: axisRelations('Entitlement', 'source'),
  // An inquiry stays when a party dies and shows that party as deleted.
  Inquiry: [...axisRelations('Inquiry', 'source'), ...axisRelations('Inquiry', 'target')],
  // A rule names these rows; it does not own them. Tombstoning one stamps the edges that name it
  // (ruleReference:target) — deleting them would erase the record that a rule is degraded.
  RuleReference: axisRelations('RuleReference', 'target'),
};
