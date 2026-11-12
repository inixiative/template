/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { type LensNarrowing, Operator } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';

export const senderOrganizationLens: LensNarrowing = {
  parent: lensFor('Organization'),
  root: {
    where: {
      all: [{ field: 'id', operator: Operator.equals, bind: 'organizationId' }],
    },
  },
};
