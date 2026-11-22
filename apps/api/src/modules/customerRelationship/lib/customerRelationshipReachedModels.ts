/**
 * @atlas
 * @kind utils
 * @partOf feature:customer
 * @uses infrastructure:prisma
 */
import { projectLens } from '@inixiative/json-rules';
import { customerRelationshipLens } from '#/modules/customerRelationship/lib/lenses/customerRelationshipLens';

export const customerRelationshipReachedModels = (): Set<string> =>
  new Set(Object.values(projectLens(customerRelationshipLens)).map((visit) => visit.model));
