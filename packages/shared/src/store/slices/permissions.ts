import type { AccessorName, HydratedRecord, OrganizationId, SpaceId, UserWithRelations } from '@template/db';
import {
  type ActionRule,
  createPermissions,
  type Entitlements,
  getOrgPermissions,
  getSpacePermissions,
  isSuperadmin,
  type Permix,
  type Role,
  rebacCheck,
  rebacSchema,
} from '@template/permissions';
import type { StateCreator } from 'zustand';
import type { AppStore } from '../types';
import type { PermissionsSlice } from '../types/permissions';

export type { PermissionsSlice };

export const createPermissionsSlice: StateCreator<AppStore, [], [], PermissionsSlice> = (set, get) => {
  const permix = createPermissions();

  return {
    permissions: {
      permix,
      check: (model, record, action) => rebacCheck(permix, rebacSchema, model, record, action),
      clear: () => {
        permix.setSuperadmin(false);
      },
      setup: async (me: UserWithRelations) => {
        permix.setUserId(me.id as any);
        if (isSuperadmin({ platformRole: me.platformRole ?? ('user' as any) })) {
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
