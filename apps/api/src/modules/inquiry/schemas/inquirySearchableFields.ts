import { searchable } from '#/lib/prisma/searchable';

export const inquirySearchableFields = searchable({
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
});
