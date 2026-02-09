import { createApiSlice } from '@template/shared/store/slices/api';
import { createAuthSlice } from '@template/shared/store/slices/auth';
import { createNavigationSlice } from '@template/shared/store/slices/navigation';
import { createPermissionsSlice } from '@template/shared/store/slices/permissions';
import { createTenantSlice } from '@template/shared/store/slices/tenant';
import { createUISlice } from '@template/shared/store/slices/ui';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  ApiSlice,
  AppStore,
  AuthSlice,
  NavigationSlice,
  PermissionsSlice,
  TenantSlice,
  UISlice,
} from './types';

// Export all types from centralized types folder
export * from './types';

// Export slice creators
export { createApiSlice } from '@template/shared/store/slices/api';
export { createAuthSlice } from '@template/shared/store/slices/auth';
export { createNavigationSlice } from '@template/shared/store/slices/navigation';
export { createPermissionsSlice } from '@template/shared/store/slices/permissions';
export { createTenantSlice } from '@template/shared/store/slices/tenant';
export { createUISlice } from '@template/shared/store/slices/ui';

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
    { name: 'SharedAppStore' },
  ),
);
