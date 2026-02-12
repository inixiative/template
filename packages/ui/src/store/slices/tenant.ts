import type { StateCreator } from 'zustand';
import type { AppStore } from '@template/ui/store/types';
import type { PageContext, TenantSlice } from '@template/ui/store/types/tenant';

export const createTenantSlice: StateCreator<AppStore, [], [], TenantSlice> = (set, get) => ({
  tenant: {
    context: { type: 'public' },
    page: {},

    setPublic: () => {
      set((state) => ({
        tenant: {
          ...state.tenant,
          context: { type: 'public' },
        },
      }));
    },

    setUser: () => {
      set((state) => ({
        tenant: {
          ...state.tenant,
          context: { type: 'user' },
        },
      }));
    },

    setOrganization: (organizationId: string) => {
      const auth = get().auth;
      const organization = auth.organizations?.[organizationId];
      if (!organization) return false;

      set((state) => ({
        tenant: {
          ...state.tenant,
          context: {
            type: 'organization',
            organization,
          },
        },
      }));
      return true;
    },

    setSpace: (spaceId: string) => {
      const auth = get().auth;
      const space = auth.spaces?.[spaceId];
      if (!space) return false;

      const organization = auth.organizations?.[space.organizationId];
      if (!organization) return false;

      set((state) => ({
        tenant: {
          ...state.tenant,
          context: {
            type: 'space',
            organization,
            space,
          },
        },
      }));
      return true;
    },

    setPage: (page: PageContext) => {
      set((state) => ({
        tenant: {
          ...state.tenant,
          page,
        },
      }));
    },

    clearPage: () => {
      set((state) => ({
        tenant: {
          ...state.tenant,
          page: {},
        },
      }));
    },
  },
});
