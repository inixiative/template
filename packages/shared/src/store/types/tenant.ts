export type TenantContext = {
  type: 'public' | 'personal' | 'organization' | 'space';
  organization?: any;
  space?: any;
  personal?: any;
};

export type PageContext = {
  organization?: any;
  space?: any;
};

export type CurrentTenantContext = {
  type: TenantContext['type'];
  label: string;
  organizationId?: string;
  spaceId?: string;
};

export type TenantSlice = {
  tenant: {
    context: TenantContext;
    page: PageContext;
    getCurrentContext: () => CurrentTenantContext;
    getNavContext: () => PageContext;
    setPublic: () => void;
    setPersonal: (personal?: any) => void;
    selectOrganization: (organizationId: string) => boolean;
    selectSpace: (spaceId: string) => boolean;
    setOrganization: (organization: any, space?: any) => void;
    setSpace: (organization: any, space: any) => void;
    setPage: (page: PageContext) => void;
  };
};
