/**
 * @atlas
 * @kind type, store
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { MeReadResponses } from '@template/sdk';

type MeData = MeReadResponses[200]['data'];
type Organization = MeData['organizations'][number];
type Space = MeData['spaces'][number];

export type TenantContext = {
  type: 'public' | 'user' | 'organization' | 'space';
  organization?: Organization;
  space?: Space;
};

export type AuthenticatedContext = Omit<TenantContext, 'type'> & {
  type: Exclude<TenantContext['type'], 'public'>;
};

export type ViewedRecords = {
  organization?: Organization;
  space?: Space;
};

export type TenantSlice = {
  tenant: {
    context: TenantContext;
    viewedRecords: ViewedRecords;
    switchToPublicContext: () => void;
    switchToUserContext: () => void;
    switchToOrganizationContext: (organizationId: string) => boolean;
    switchToSpaceContext: (spaceId: string) => boolean;
    setViewedRecords: (viewedRecords: ViewedRecords) => void;
    clearViewedRecords: () => void;
  };
};
