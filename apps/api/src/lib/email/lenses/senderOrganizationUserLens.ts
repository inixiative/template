/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { type LensNarrowing, Operator } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';

export const senderOrganizationUserLens: LensNarrowing = {
  parent: lensFor('OrganizationUser'),
  root: {
    where: {
      all: [
        { field: 'userId', operator: Operator.equals, bind: 'userId' },
        { field: 'organizationId', operator: Operator.equals, bind: 'organizationId' },
      ],
    },
  },
};
