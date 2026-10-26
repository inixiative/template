/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { type LensNarrowing, Operator } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';

export const senderSpaceUserLens: LensNarrowing = {
  parent: lensFor('SpaceUser'),
  root: {
    where: {
      all: [
        { field: 'userId', operator: Operator.equals, bind: 'userId' },
        { field: 'spaceId', operator: Operator.equals, bind: 'spaceId' },
      ],
    },
  },
};
