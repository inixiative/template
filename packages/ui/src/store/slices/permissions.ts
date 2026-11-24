/**
 * @atlas
 * @kind store
 * @partOf primitive:ui
 * @uses primitive:sdk
 */

import { actorFromRecordOmittingSensitiveFields } from '@template/permissions/actorFromRecordOmittingSensitiveFields';
import { ActorModel, createPermissions, installPermissions } from '@template/permissions/client';
import { check as rebacCheck } from '@template/permissions/rebac/check';
import { permissionsOfUser } from '@template/permissions/roles/permissionsOfUser';
import { isSuperadmin } from '@template/permissions/roles/shared';
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
        return rebacCheck(permix, model, record, action);
      },
      clear: () => {
        set((state) => ({
          permissions: {
            ...state.permissions,
            permix: createPermissions(),
          },
        }));
      },
      installPermissionsForUser: async (me: UserWithRelations) => {
        const { permix } = get().permissions;
        await permix.setup([], { replace: true });
        permix.setActor(actorFromRecordOmittingSensitiveFields(ActorModel.User, me));
        if (isSuperadmin(me)) {
          permix.setSuperadmin(true);
          return;
        }

        await installPermissions(
          permix,
          permissionsOfUser(me.id, me.organizationUsers ?? [], me.spaceUsers ?? []),
        );
      },
    },
  };
};
