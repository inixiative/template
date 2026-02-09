import {
  type ApiSlice,
  type AuthSlice,
  createApiSlice,
  createAuthSlice,
  createNavigationSlice,
  createPermissionsSlice,
  createUISlice,
  type NavigationSlice,
  type PermissionsSlice,
  type UISlice,
} from '@template/shared';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type AppStore = ApiSlice & AuthSlice & NavigationSlice & PermissionsSlice & UISlice;

export const useAppStore = create<AppStore>()(
  devtools(
    (...a) => ({
      ...createApiSlice(...a),
      ...createAuthSlice(...a),
      ...createNavigationSlice(...a),
      ...createPermissionsSlice(...a),
      ...createUISlice(...a),
    }),
    { name: 'SuperadminStore' },
  ),
);
