/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses feature:tenancy, feature:users
 */
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { Context } from 'hono';
import { actingUser } from '#/lib/context/actingUser';
import { contextResource, contextResourceType } from '#/lib/context/contextResource';
import type { AppEnv } from '#/types/appEnv';

const nullSourceFields = {
  sourceUserId: null,
  sourceOrganizationId: null,
  sourceSpaceId: null,
  sourceIntegrationId: null,
  sourceTokenId: null,
  sourceProjectId: null,
};

export type InquirySourceFields =
  | { sourceModel: (typeof InquiryResourceModel)['User']; sourceUserId: string }
  | {
      sourceModel: (typeof InquiryResourceModel)['Organization'];
      sourceOrganizationId: string;
    }
  | {
      sourceModel: (typeof InquiryResourceModel)['Space'];
      sourceOrganizationId: string;
      sourceSpaceId: string;
    }
  | { sourceModel: (typeof InquiryResourceModel)['admin'] };

export const resolveInquirySource = (c: Context<AppEnv>): InquirySourceFields => {
  const resourceType = contextResourceType(c);

  if (resourceType === 'organization') {
    const org = contextResource<'organization'>(c);
    return {
      ...nullSourceFields,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: org.id,
    };
  }

  if (resourceType === 'space') {
    const space = contextResource<'space'>(c);
    return {
      ...nullSourceFields,
      sourceModel: InquiryResourceModel.Space,
      sourceOrganizationId: space.organizationId,
      sourceSpaceId: space.id,
    };
  }

  const user = actingUser(c)!;
  return {
    ...nullSourceFields,
    sourceModel: InquiryResourceModel.User,
    sourceUserId: user.id,
  };
};
