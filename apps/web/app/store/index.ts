import {
  type ClientSlice,
  type AuthSlice,
  createClientSlice,
  createAuthSlice,
  createNavigationSlice,
  createPermissionsSlice,
  createTenantSlice,
  createUISlice,
  type NavigationSlice,
  type PermissionsSlice,
  type TenantSlice,
  type UISlice,
} from '@template/ui/store';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type AppStore = ClientSlice & AuthSlice & NavigationSlice & PermissionsSlice & TenantSlice & UISlice;

export const useAppStore = create<AppStore>()(
  devtools(
    (...a) => ({
      ...createClientSlice(...a),
      ...createAuthSlice(...a),
      ...createNavigationSlice(...a),
      ...createPermissionsSlice(...a),
      ...createTenantSlice(...a),
      ...createUISlice(...a),
    }),
    { name: 'AppStore' },
  ),
);
