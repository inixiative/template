import type { StateCreator } from 'zustand';
import type { AppStore } from '../types';

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

export const createTenantSlice: StateCreator<AppStore, [], [], TenantSlice> = (set, get) => ({
  tenant: {
    context: {
      type: 'public',
      personal: null,
    },
    page: {},

    getCurrentContext: () => {
      const context = get().tenant.context;
      return {
        type: context.type,
        label:
          context.type === 'public'
            ? 'Public'
            : context.type === 'personal'
              ? 'Personal'
              : context.type === 'organization'
                ? context.organization?.name || 'Organization'
                : context.space?.name || 'Space',
        organizationId: context.organization?.id,
        spaceId: context.space?.id,
      };
    },

    getNavContext: () => {
      const tenant = get().tenant;
      return {
        organization: tenant.page.organization || tenant.context.organization,
        space: tenant.page.space || tenant.context.space,
      };
    },

    setPublic: () => {
      // Don't allow setting to public if user is authenticated
      const auth = get().auth;
      if (auth.isAuthenticated) return;

      set((state) => ({
        tenant: {
          ...state.tenant,
          context: {
            type: 'public',
            organization: undefined,
            space: undefined,
            personal: undefined,
          },
        },
      }));
    },

    setPersonal: (personal = null) =>
      set((state) => ({
        tenant: {
          ...state.tenant,
          context: {
            type: 'personal',
            personal,
            organization: undefined,
            space: undefined,
          },
        },
      })),

    selectOrganization: (organizationId: string) => {
      const auth = get().auth;
      const organization = auth.organizations?.find((org) => org.id === organizationId);
      if (!organization) return false;

      set((state) => ({
        tenant: {
          ...state.tenant,
          context: {
            type: 'organization',
            organization,
            space: undefined,
            personal: undefined,
          },
        },
      }));
      return true;
    },

    selectSpace: (spaceId: string) => {
      const auth = get().auth;
      const space = auth.spaces?.find((s) => s.id === spaceId);
      const organization = auth.organizations?.find((org) => org.id === space?.organizationId);

      if (!organization || !space) return false;

      set((state) => ({
        tenant: {
          ...state.tenant,
          context: {
            type: 'space',
            organization,
            space,
            personal: undefined,
          },
        },
      }));
      return true;
    },

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

    setPage: (page) =>
      set((state) => ({
        tenant: {
          ...state.tenant,
          page,
        },
      })),
  },
});
