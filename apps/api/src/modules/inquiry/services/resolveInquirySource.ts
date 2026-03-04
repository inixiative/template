import type { OrganizationId, SpaceId, UserId } from '@template/db';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { Context } from 'hono';
import { getResource, getResourceType } from '#/lib/context/getResource';
import type { AppEnv } from '#/types/appEnv';

export type InquirySourceFields =
  | { sourceModel: (typeof InquiryResourceModel)['User']; sourceUserId: UserId }
  | { sourceModel: (typeof InquiryResourceModel)['Organization']; sourceOrganizationId: OrganizationId }
  | { sourceModel: (typeof InquiryResourceModel)['Space']; sourceSpaceId: SpaceId }
  | { sourceModel: (typeof InquiryResourceModel)['admin'] };

export const resolveInquirySource = (c: Context<AppEnv>): InquirySourceFields => {
  const resourceType = getResourceType(c);

  if (resourceType === 'organization') {
    const org = getResource<'organization'>(c);
    return { sourceModel: InquiryResourceModel.Organization, sourceOrganizationId: org.id as OrganizationId };
  }

  if (resourceType === 'space') {
    const space = getResource<'space'>(c);
    return { sourceModel: InquiryResourceModel.Space, sourceSpaceId: space.id as SpaceId };
  }

  const user = c.get('user')!;
  return { sourceModel: InquiryResourceModel.User, sourceUserId: user.id as UserId };
};
