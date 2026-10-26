/**
 * @atlas
 * @kind store
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { actorOf } from '@template/permissions/actorOf';
import { ActorModel, createPermissions } from '@template/permissions/client';
import { check as rebacCheck } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { isSuperadmin } from '@template/permissions/roles/shared';
import { installGrants, userGrants } from '@template/permissions/roles/userGrants';
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
        permix.setActor(actorOf(ActorModel.User, me));
        if (isSuperadmin(me)) {
          permix.setSuperadmin(true);
          return;
        }

        await installGrants(
          permix,
          userGrants(me.id, me.organizationUsers ?? [], me.spaceUsers ?? []),
        );
      },
    },
  };
};
