/**
 * @atlas
 * @kind config
 * @partOf feature:customer
 * @uses infrastructure:prisma
 */
import { type LensNarrowing, Operator } from '@inixiative/json-rules';
import { customerRefLens } from '#/modules/customerRef/lib/lenses/customerRefLens';

export const customerRefsByIdLens: LensNarrowing = {
  parent: customerRefLens,
  root: { where: { field: 'id', operator: Operator.in, bind: 'customerRefIds' } },
};
