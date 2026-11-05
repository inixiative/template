/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses feature:tenancy, feature:users
 */
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { Context } from 'hono';
import { getResource, getResourceType } from '#/lib/context/getResource';
import { me } from '#/lib/context/me';
import type { AppEnv } from '#/types/appEnv';

const nullSourceFields = {
  sourceUserId: null,
  sourceOrganizationId: null,
  sourceSpaceId: null,
  sourceIntegrationId: null,
  sourceTokenId: null,
};

export type InquirySourceFields =
  | { sourceModel: (typeof InquiryResourceModel)['User']; sourceUserId: string }
  | {
      sourceModel: (typeof InquiryResourceModel)['Organization'];
      sourceOrganizationId: string;
    }
  | { sourceModel: (typeof InquiryResourceModel)['Space']; sourceSpaceId: string }
  | { sourceModel: (typeof InquiryResourceModel)['admin'] };

export const resolveInquirySource = (c: Context<AppEnv>): InquirySourceFields => {
  const resourceType = getResourceType(c);

  if (resourceType === 'organization') {
    const org = getResource<'organization'>(c);
    return {
      ...nullSourceFields,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
    };
  }

  if (resourceType === 'space') {
    const space = getResource<'space'>(c);
    return {
      ...nullSourceFields,
      sourceModel: InquiryResourceModel.Space,
      sourceSpaceId: space.id,
    };
  }

  const user = me(c)!;
  return {
    ...nullSourceFields,
    sourceModel: InquiryResourceModel.User,
    sourceUserId: user.id,
  };
};
