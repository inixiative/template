/**
 * @atlas
 * @kind store
 * @partOf primitive:ui
 * @uses none
 */
import type { AppStore } from '@template/ui/store/types';
import type { TenantSlice, ViewedRecords } from '@template/ui/store/types/tenant';
import type { StateCreator } from 'zustand';

export const createTenantSlice: StateCreator<AppStore, [], [], TenantSlice> = (set, get) => ({
  tenant: {
    context: { type: 'public' },
    viewedRecords: {},

    switchToPublicContext: () => {
      set((state) => ({
        tenant: {
          ...state.tenant,
          context: { type: 'public' },
        },
      }));
    },

    switchToUserContext: () => {
      set((state) => ({
        tenant: {
          ...state.tenant,
          context: { type: 'user' },
        },
      }));
    },

    switchToOrganizationContext: (organizationId: string) => {
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

    switchToSpaceContext: (spaceId: string) => {
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

    setViewedRecords: (viewedRecords: ViewedRecords) => {
      set((state) => ({
        tenant: {
          ...state.tenant,
          viewedRecords,
        },
      }));
    },

    clearViewedRecords: () => {
      set((state) => ({
        tenant: {
          ...state.tenant,
          viewedRecords: {},
        },
      }));
    },
  },
});
