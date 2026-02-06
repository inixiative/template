import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  createApiSlice,
  createAuthSlice,
  createPermissionsSlice,
  createTenantSlice,
  createUISlice,
  type ApiSlice,
  type AuthSlice,
  type PermissionsSlice,
  type TenantSlice,
  type UISlice,
} from '@template/shared';

export type AppStore = ApiSlice & AuthSlice & PermissionsSlice & TenantSlice & UISlice;

export const useAppStore = create<AppStore>()(
  devtools(
    (...a) => ({
      ...createApiSlice(...a),
      ...createAuthSlice(...a),
      ...createPermissionsSlice(...a),
      ...createTenantSlice(...a),
      ...createUISlice(...a),
    }),
    { name: 'AppStore' },
  ),
);
