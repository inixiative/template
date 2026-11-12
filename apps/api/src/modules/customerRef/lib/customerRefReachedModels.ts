/**
 * @atlas
 * @kind helper
 * @partOf feature:customer
 * @uses infrastructure:prisma
 */
import { projectLens } from '@inixiative/json-rules';
import { customerRefLens } from '#/modules/customerRef/lib/lenses/customerRefLens';

export const customerRefReachedModels = (): Set<string> =>
  new Set(Object.values(projectLens(customerRefLens)).map((visit) => visit.model));
