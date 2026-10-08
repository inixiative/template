/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { EmailLensOwner } from '@template/email/rules';
import type { Sender } from '#/lib/email/sender';

export const senderLensOwner = (sender: Sender): EmailLensOwner => {
  switch (sender.type) {
    case 'Organization':
    case 'OrganizationUser':
      return { ownerModel: 'Organization', ownerId: sender.organizationId };
    case 'Space':
    case 'SpaceUser':
      return {
        ownerModel: 'Space',
        ownerId: sender.spaceId,
        organizationId: sender.organizationId,
      };
    case 'User':
      return { ownerModel: 'User', ownerId: sender.userId };
    default:
      return null;
  }
};
