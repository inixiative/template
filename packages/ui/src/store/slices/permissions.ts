/**
 * @atlas
 * @kind store
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { OrganizationId, SpaceId, UserId } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import { ActorModel, buildActor } from '@template/permissions/actor';
import { createPermissions } from '@template/permissions/client';
import {
  entitlementEntries,
  normalizeEntitlements,
  resolveSelfKeys,
} from '@template/permissions/holder';
import { check as rebacCheck } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { getOrgPermissions } from '@template/permissions/roles/organization';
import { isSuperadmin } from '@template/permissions/roles/shared';
import { getSpacePermissions } from '@template/permissions/roles/space';
import { getUserPermissions } from '@template/permissions/roles/user';
import type { MeReadResponses } from '@template/sdk';
import type { AppStore } from '@template/ui/store/types';
import type { PermissionsSlice } from '@template/ui/store/types/permissions';
import type { StateCreator } from 'zustand';

type UserWithRelations = MeReadResponses[200]['data'];

export type { PermissionsSlice };

export const createPermissionsSlice: StateCreator<AppStore, [], [], PermissionsSlice> = (
  set,
  get,
) => {
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
        permix.setActor(buildActor(me.id, ActorModel.User));
        if (isSuperadmin(me)) {
          permix.setSuperadmin(true);
          return;
        }

        await permix.setup(getUserPermissions(me.id as UserId, 'owner'));

        for (const orgUser of me.organizationUsers ?? []) {
          const organizationId = orgUser.organizationId as OrganizationId;
          await permix.setup(getOrgPermissions(orgUser.role as Role, organizationId));
          await permix.setup(
            entitlementEntries(
              resolveSelfKeys(
                normalizeEntitlements(orgUser.entitlements, `db:organization:${organizationId}`),
                { organization: organizationId, user: me.id, organizationUser: orgUser.id },
              ),
            ),
          );
        }

        for (const spaceUser of me.spaceUsers ?? []) {
          const spaceId = spaceUser.spaceId as SpaceId;
          await permix.setup(getSpacePermissions(spaceUser.role as Role, spaceId));
          await permix.setup(
            entitlementEntries(
              resolveSelfKeys(
                normalizeEntitlements(spaceUser.entitlements, `db:space:${spaceId}`),
                {
                  space: spaceId,
                  organization: spaceUser.organizationId,
                  user: me.id,
                  spaceUser: spaceUser.id,
                },
              ),
            ),
          );
        }
      },
    },
  };
};
