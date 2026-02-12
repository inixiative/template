import { createAuthSlice } from '@template/ui/store/slices/auth';
import { createClientSlice } from '@template/ui/store/slices/client';
import { createNavigationSlice } from '@template/ui/store/slices/navigation';
import { createPermissionsSlice } from '@template/ui/store/slices/permissions';
import { createTenantSlice } from '@template/ui/store/slices/tenant';
import { createUISlice } from '@template/ui/store/slices/ui';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  AppStore,
  AuthSlice,
  ClientSlice,
  NavigationSlice,
  PermissionsSlice,
  TenantSlice,
  UISlice,
} from './types';

// Export all types from centralized types folder
export * from './types';

// Export slice creators
export { createAuthSlice } from '@template/ui/store/slices/auth';
export { createClientSlice } from '@template/ui/store/slices/client';
export { createNavigationSlice } from '@template/ui/store/slices/navigation';
export { createPermissionsSlice } from '@template/ui/store/slices/permissions';
export { createTenantSlice } from '@template/ui/store/slices/tenant';
export { createUISlice } from '@template/ui/store/slices/ui';

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
    { name: 'SharedAppStore' },
  ),
);
