import {
  type ApiSlice,
  type AuthSlice,
  createApiSlice,
  createAuthSlice,
  createNavigationSlice,
  createPermissionsSlice,
  createTenantSlice,
  createUISlice,
  type NavigationSlice,
  type PermissionsSlice,
  type TenantSlice,
  type UISlice,
} from '@template/shared';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type AppStore = ApiSlice & AuthSlice & NavigationSlice & PermissionsSlice & TenantSlice & UISlice;

export const useAppStore = create<AppStore>()(
  devtools(
    (...a) => ({
      ...createApiSlice(...a),
      ...createAuthSlice(...a),
      ...createNavigationSlice(...a),
      ...createPermissionsSlice(...a),
      ...createTenantSlice(...a),
      ...createUISlice(...a),
    }),
    { name: 'AppStore' },
  ),
);
