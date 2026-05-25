import type { LensNarrowing } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import { searchable } from '#/lib/prisma/searchable';

export const inquiryNarrowing: LensNarrowing = {
  parent: lensFor('Inquiry'),
  maps: {
    default: {
      models: {
        Inquiry: {
          picks: [
            ...searchable({
              inquiry: [
                'type',
                'status',
                'sourceModel',
                'targetModel',
                'sourceUserId',
                'sourceOrganizationId',
                'sourceSpaceId',
                'targetUserId',
                'targetOrganizationId',
                'targetSpaceId',
                'expiresAt',
              ],
            }),
          ],
        },
      },
    },
  },
};
