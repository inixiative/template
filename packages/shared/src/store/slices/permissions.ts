import type { StateCreator } from 'zustand';
import type { AccessorName, HydratedRecord, OrganizationId, SpaceId } from '@template/db';
import {
  createPermissions,
  rebacCheck,
  rebacSchema,
  isSuperadmin,
  setupOrgContext,
  setupSpaceContext,
  type Permix,
  type ActionRule,
  type Role,
  type SpaceRole,
  type Entitlements,
} from '@template/permissions';

type MeResponse = {
  id: string;
  platformRole?: string;
  organizationUsers?: Array<{
    organizationId: string;
    role: string;
    entitlements: Entitlements;
  }>;
  spaceUsers?: Array<{
    spaceId: string;
    role: string;
    entitlements: Entitlements;
  }>;
};

export type PermissionsSlice = {
  permissions: Permix & {
    check: (model: AccessorName, record: HydratedRecord, action: ActionRule) => boolean;
    hydrate: (me: MeResponse) => Promise<void>;
    clear: () => void;
  };
};

export const createPermissionsSlice: StateCreator<PermissionsSlice> = (set, get) => {
  const permix = createPermissions();

  return {
    permissions: {
      ...permix,
      check: (model, record, action) => rebacCheck(permix, rebacSchema, model, record, action),
      clear: () => {
        permix.setUserId(null);
        permix.setSuperadmin(false);
        // Reset all contexts by creating fresh permix
        set({ permissions: createPermissionsSlice(set, get).permissions });
      },
      hydrate: async (me) => {
        permix.setUserId(me.id);
        if (isSuperadmin({ platformRole: me.platformRole })) {
          permix.setSuperadmin(true);
          return;
        }

        // Set up org contexts (matches backend setupOrgPermissions)
        if (me.organizationUsers) {
          for (const orgUser of me.organizationUsers) {
            await setupOrgContext(permix, {
              role: orgUser.role as Role,
              orgId: orgUser.organizationId as OrganizationId,
              entitlements: orgUser.entitlements,
            });
          }
        }

        // Set up space contexts (matches backend setupSpacePermissions)
        if (me.spaceUsers) {
          for (const spaceUser of me.spaceUsers) {
            await setupSpaceContext(permix, {
              role: spaceUser.role as SpaceRole,
              spaceId: spaceUser.spaceId as SpaceId,
              entitlements: spaceUser.entitlements,
            });
          }
        }
      },
    },
  };
};
