/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { type LensNarrowing, Operator } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';

export const senderSpaceLens: LensNarrowing = {
  parent: lensFor('Space'),
  root: {
    where: {
      all: [{ field: 'id', operator: Operator.equals, bind: 'spaceId' }],
    },
  },
};
