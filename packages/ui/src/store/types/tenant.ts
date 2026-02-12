import type { MeReadResponses } from '@template/ui/apiClient';

type MeData = MeReadResponses[200]['data'];
type Organization = MeData['organizations'][number];
type Space = MeData['spaces'][number];

export type TenantContext = {
  type: 'public' | 'user' | 'organization' | 'space';
  organization?: Organization;
  space?: Space;
};

export type PageContext = {
  organization?: Organization;
  space?: Space;
};

export type TenantSlice = {
  tenant: {
    context: TenantContext;
    page: PageContext;
    setPublic: () => void;
    setUser: () => void;
    setOrganization: (organizationId: string) => boolean;
    setSpace: (spaceId: string) => boolean;
    setPage: (page: PageContext) => void;
    clearPage: () => void;
  };
};
