import type { OrganizationId, SpaceId, UserId } from '@template/db';
import {
  createPermissions,
  type Entitlements,
  getOrgPermissions,
  getSpacePermissions,
  isSuperadmin,
  type Role,
  rebacCheck,
  rebacSchema,
} from '@template/permissions';
import type { StateCreator } from 'zustand';
import type { AppStore } from '@template/ui/store/types';
import type { PermissionsSlice } from '@template/ui/store/types/permissions';
import type { MeReadResponses } from '@template/ui/apiClient';

type UserWithRelations = MeReadResponses[200]['data'];

export type { PermissionsSlice };

export const createPermissionsSlice: StateCreator<AppStore, [], [], PermissionsSlice> = (set, get) => {
  return {
    permissions: {
      permix: createPermissions(),
      check: (model, record, action) => {
        const { permix } = get().permissions;
        return rebacCheck(permix, rebacSchema, model, record, action);
      },
      clear: () => {
        set((state) => ({
          permissions: {
            ...state.permissions,
            permix: createPermissions(),
          },
        }));
      },
      setup: async (me: UserWithRelations) => {
        const { permix } = get().permissions;
        permix.setUserId(me.id as UserId);
        if (isSuperadmin(me)) {
          permix.setSuperadmin(true);
          return;
        }

        // Set up org permissions (matches backend setupOrgPermissions)
        if (me.organizationUsers) {
          for (const orgUser of me.organizationUsers) {
            await permix.setup(
              getOrgPermissions(
                orgUser.role as Role,
                orgUser.organizationId as OrganizationId,
                orgUser.entitlements as Entitlements,
              ),
            );
          }
        }

        // Set up space permissions (matches backend setupSpacePermissions)
        if (me.spaceUsers) {
          for (const spaceUser of me.spaceUsers) {
            await permix.setup(
              getSpacePermissions(
                spaceUser.role as Role,
                spaceUser.spaceId as SpaceId,
                spaceUser.entitlements as Entitlements,
              ),
            );
          }
        }
      },
    },
  };
};
