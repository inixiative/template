/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { bindLens, type LensNarrowing } from '@inixiative/json-rules';
import { fetchLens } from '@template/db/hydrate';
import { senderOrganizationLens } from '#/lib/email/lenses/senderOrganizationLens';
import { senderOrganizationUserLens } from '#/lib/email/lenses/senderOrganizationUserLens';
import { senderSpaceLens } from '#/lib/email/lenses/senderSpaceLens';
import { senderSpaceUserLens } from '#/lib/email/lenses/senderSpaceUserLens';
import { senderUserLens } from '#/lib/email/lenses/senderUserLens';
import type { Sender } from '#/lib/email/sender';

const senderRowLens = (sender: Sender): LensNarrowing | null => {
  switch (sender.type) {
    case 'User':
      return bindLens(senderUserLens, { userId: sender.userId });
    case 'Organization':
      return bindLens(senderOrganizationLens, { organizationId: sender.organizationId });
    case 'Space':
      return bindLens(senderSpaceLens, { spaceId: sender.spaceId });
    case 'OrganizationUser':
      return bindLens(senderOrganizationUserLens, {
        userId: sender.userId,
        organizationId: sender.organizationId,
      });
    case 'SpaceUser':
      return bindLens(senderSpaceUserLens, { userId: sender.userId, spaceId: sender.spaceId });
    default:
      return null;
  }
};

export const resolveSender = async (
  sender: Sender,
): Promise<Record<string, unknown> | undefined> => {
  const lens = senderRowLens(sender);
  if (!lens) return undefined;
  const [found] = await fetchLens(lens);
  return found;
};
