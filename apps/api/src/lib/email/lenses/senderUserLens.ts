/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { type LensNarrowing, Operator } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';

export const senderUserLens: LensNarrowing = {
  parent: lensFor('User'),
  root: {
    where: {
      all: [{ field: 'id', operator: Operator.equals, bind: 'userId' }],
    },
  },
};
