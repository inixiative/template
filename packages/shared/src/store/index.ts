import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ApiSlice } from './slices/api';
import type { AuthSlice } from './slices/auth';
import type { PermissionsSlice } from './slices/permissions';
import type { TenantSlice } from './slices/tenant';
import type { UISlice } from './slices/ui';
import { createApiSlice } from './slices/api';
import { createAuthSlice } from './slices/auth';
import { createPermissionsSlice } from './slices/permissions';
import { createTenantSlice } from './slices/tenant';
import { createUISlice } from './slices/ui';

// Export individual slice creators for composition
export { createApiSlice, type ApiSlice } from './slices/api';
export { createAuthSlice, type AuthSlice } from './slices/auth';
export { createPermissionsSlice, type PermissionsSlice } from './slices/permissions';
export { createTenantSlice, type TenantSlice } from './slices/tenant';
export { createUISlice, type UISlice } from './slices/ui';

// Export all types
export * from './slices/api';
export * from './slices/auth';
export * from './slices/permissions';
export * from './slices/tenant';
export * from './slices/ui';

// Create a composed store for testing/standalone usage
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
    { name: 'SharedAppStore' },
  ),
);
