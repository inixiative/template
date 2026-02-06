import type { StateCreator } from 'zustand';

export type TenantContext = {
  type: 'personal' | 'organization' | 'space';
  organization?: any;
  space?: any;
  personal?: any;
};

export type PageContext = {
  organization?: any;
  space?: any;
};

export type TenantSlice = {
  tenant: {
    context: TenantContext;
    page: PageContext;
    setOrganization: (organization: any, space?: any) => void;
    setSpace: (organization: any, space: any) => void;
    setPersonal: (personal: any) => void;
    setPage: (page: PageContext) => void;
  };
};

export const createTenantSlice: StateCreator<TenantSlice> = (set) => ({
  tenant: {
    context: {
      type: 'personal',
      personal: null,
    },
    page: {},

    setOrganization: (organization, space) =>
      set((state) => ({
        tenant: {
          ...state.tenant,
          context: {
            type: 'organization',
            organization,
            space,
          },
        },
      })),

    setSpace: (organization, space) =>
      set((state) => ({
        tenant: {
          ...state.tenant,
          context: {
            type: 'space',
            organization,
            space,
          },
        },
      })),

    setPersonal: (personal) =>
      set((state) => ({
        tenant: {
          ...state.tenant,
          context: {
            type: 'personal',
            personal,
          },
        },
      })),

    setPage: (page) =>
      set((state) => ({
        tenant: {
          ...state.tenant,
          page,
        },
      })),
  },
});
