/**
 * @atlas
 * @kind config
 * @partOf feature:customer
 * @uses infrastructure:prisma
 */
import { type LensNarrowing, Operator } from '@inixiative/json-rules';
import { customerRelationshipLens } from '#/modules/customerRelationship/lib/lenses/customerRelationshipLens';

export const customerRelationshipsByIdLens: LensNarrowing = {
  parent: customerRelationshipLens,
  root: { where: { field: 'id', operator: Operator.in, bind: 'customerRelationshipIds' } },
};
